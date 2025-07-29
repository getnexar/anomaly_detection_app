import numpy as np
import pandas as pd
import logging
from typing import List, Dict, Tuple, Optional
from openai import OpenAI
import time
import pickle
from dataclasses import dataclass

from config.config import config

@dataclass
class EmbeddingConfig:
    model: str = "text-embedding-3-large"
    dimension: int = 3072
    batch_size: int = 100
    primary_weight: float = 0.7
    anomaly_weight: float = 0.2
    categorical_weight: float = 0.1

class MultiLayeredEmbeddingGenerator:
    def __init__(self, openai_client: OpenAI, embedding_config: EmbeddingConfig = None):
        self.client = openai_client
        self.config = embedding_config or EmbeddingConfig()
        self.logger = logging.getLogger(__name__)
        
        # Anomaly keywords for enhanced weighting
        self.anomaly_keywords = config.anomaly.anomaly_keywords
        self.normal_indicators = config.anomaly.normal_indicators
        
        # Statistics
        self.total_requests = 0
        self.total_tokens = 0
        self.failed_requests = 0
    
    def create_primary_embedding(self, video_row: Dict) -> np.ndarray:
        """Generate primary content embedding (70% weight)"""
        components = []
        
        # Core content with weighted importance
        if pd.notna(video_row.get('video-title')):
            components.append(f"Title: {video_row['video-title']}")
        
        if pd.notna(video_row.get('description-step-by-step')):
            components.append(f"Description: {video_row['description-step-by-step']}")
        
        if pd.notna(video_row.get('general-description')):
            components.append(f"Summary: {video_row['general-description']}")
        
        # Objects with contextual framing
        if pd.notna(video_row.get('observed-objects')):
            objects = video_row['observed-objects']
            if isinstance(objects, str):
                components.append(f"Objects observed: {objects}")
        
        # Key terms for semantic enhancement
        if pd.notna(video_row.get('key-terms')):
            terms = video_row['key-terms']
            if isinstance(terms, str):
                components.append(f"Key concepts: {terms}")
        
        primary_text = " | ".join(components)
        return self._get_embedding(primary_text)
    
    def create_anomaly_embedding(self, video_row: Dict) -> Tuple[np.ndarray, float]:
        """Generate anomaly-focused embedding (20% weight)"""
        interpretation = video_row.get('interpretation', '')
        
        # Calculate anomaly weight based on content
        anomaly_multiplier = 0.1  # Base weight for normal content
        
        if isinstance(interpretation, str):
            interp_lower = interpretation.lower()
            
            # Check for explicit anomaly indicators
            if not any(indicator in interp_lower for indicator in self.normal_indicators):
                anomaly_multiplier = 0.5
            
            # Boost for specific anomaly keywords
            for keyword, weight in self.anomaly_keywords.items():
                if keyword in interp_lower:
                    anomaly_multiplier = min(1.0, anomaly_multiplier + weight * 0.3)
            
            # Context-aware anomaly text
            anomaly_text = f"Analysis: {interpretation}"
        else:
            anomaly_text = "Analysis: no specific analysis provided"
        
        embedding = self._get_embedding(anomaly_text)
        return embedding, anomaly_multiplier
    
    def create_categorical_embedding(self, video_row: Dict) -> np.ndarray:
        """Generate categorical metadata embedding (10% weight)"""
        categorical_components = []
        
        # Structured metadata with semantic context
        metadata_fields = [
            ('main-event', 'Event type'),
            ('location', 'Location'),
            ('zone', 'Zone type'),
            ('light-conditions', 'Lighting'),
            ('weather-conditions', 'Weather'),
            ('road-conditions', 'Road conditions'),
            ('type-of-vehicle-recording', 'Recording vehicle')
        ]
        
        for field, label in metadata_fields:
            value = video_row.get(field)
            if pd.notna(value):
                categorical_components.append(f"{label}: {value}")
        
        categorical_text = " | ".join(categorical_components)
        return self._get_embedding(categorical_text)
    
    def generate_multi_layered_embedding(self, video_row: Dict) -> np.ndarray:
        """Create final combined embedding using multi-layered strategy"""
        try:
            # Generate component embeddings
            primary_emb = self.create_primary_embedding(video_row)
            anomaly_emb, anomaly_mult = self.create_anomaly_embedding(video_row)
            categorical_emb = self.create_categorical_embedding(video_row)
            
            # Weighted combination with dynamic anomaly weighting
            combined = (
                self.config.primary_weight * primary_emb +
                self.config.anomaly_weight * anomaly_mult * anomaly_emb +
                self.config.categorical_weight * categorical_emb
            )
            
            # L2 normalization for cosine similarity
            return combined / (np.linalg.norm(combined) + 1e-8)
            
        except Exception as e:
            self.logger.error(f"Error generating embedding for video {video_row.get('video_id', 'unknown')}: {e}")
            self.failed_requests += 1
            # Return zero embedding as fallback
            return np.zeros(self.config.dimension)
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding from OpenAI API with error handling and retry logic"""
        max_retries = config.openai.max_retries
        retry_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                response = self.client.embeddings.create(
                    model=self.config.model,
                    input=text,
                    encoding_format="float"
                )
                
                self.total_requests += 1
                # Note: token counting would need to be implemented separately
                
                return np.array(response.data[0].embedding)
                
            except Exception as e:
                self.logger.warning(f"OpenAI API error (attempt {attempt + 1}/{max_retries}): {e}")
                
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    self.logger.error(f"Failed to get embedding after {max_retries} attempts")
                    self.failed_requests += 1
                    return np.zeros(self.config.dimension)
    
    def generate_embeddings_batch(self, video_data: pd.DataFrame, 
                                 start_idx: int = 0, 
                                 batch_size: Optional[int] = None) -> Tuple[np.ndarray, List[str]]:
        """Generate embeddings for a batch of videos"""
        if batch_size is None:
            batch_size = self.config.batch_size
        
        end_idx = min(start_idx + batch_size, len(video_data))
        batch_data = video_data.iloc[start_idx:end_idx]
        
        embeddings = []
        video_ids = []
        
        self.logger.info(f"Generating embeddings for batch {start_idx}-{end_idx}")
        
        for idx, (_, row) in enumerate(batch_data.iterrows()):
            if idx % 10 == 0:  # Progress logging
                self.logger.info(f"Processing video {start_idx + idx + 1}/{end_idx}")
            
            embedding = self.generate_multi_layered_embedding(row.to_dict())
            embeddings.append(embedding)
            video_ids.append(row.get('video_id', f'video_{start_idx + idx}'))
        
        embeddings_array = np.array(embeddings)
        
        self.logger.info(f"Generated {len(embeddings)} embeddings")
        return embeddings_array, video_ids
    
    def generate_all_embeddings(self, video_data: pd.DataFrame, 
                               save_path: Optional[str] = None) -> Tuple[np.ndarray, List[str]]:
        """Generate embeddings for all videos with progress tracking"""
        total_videos = len(video_data)
        self.logger.info(f"Starting embedding generation for {total_videos} videos")
        
        all_embeddings = []
        all_video_ids = []
        
        for start_idx in range(0, total_videos, self.config.batch_size):
            embeddings_batch, video_ids_batch = self.generate_embeddings_batch(
                video_data, start_idx, self.config.batch_size
            )
            
            all_embeddings.append(embeddings_batch)
            all_video_ids.extend(video_ids_batch)
            
            # Progress update
            processed = min(start_idx + self.config.batch_size, total_videos)
            progress = (processed / total_videos) * 100
            self.logger.info(f"Progress: {processed}/{total_videos} ({progress:.1f}%)")
            
            # Save intermediate results periodically
            if save_path and processed % (self.config.batch_size * 5) == 0:
                current_embeddings = np.vstack(all_embeddings)
                self._save_intermediate_results(current_embeddings, all_video_ids, 
                                              f"{save_path}_checkpoint_{processed}")
        
        # Combine all embeddings
        final_embeddings = np.vstack(all_embeddings)
        
        # Save final results
        if save_path:
            self.save_embeddings(final_embeddings, all_video_ids, save_path)
        
        self.logger.info(f"Completed embedding generation. Statistics:")
        self.logger.info(f"  Total requests: {self.total_requests}")
        self.logger.info(f"  Failed requests: {self.failed_requests}")
        self.logger.info(f"  Success rate: {((self.total_requests - self.failed_requests) / max(self.total_requests, 1)) * 100:.1f}%")
        
        return final_embeddings, all_video_ids
    
    def save_embeddings(self, embeddings: np.ndarray, video_ids: List[str], 
                       save_path: str):
        """Save embeddings and metadata to files"""
        try:
            # Save embeddings as numpy array
            np.save(f"{save_path}_embeddings.npy", embeddings)
            
            # Save video IDs and metadata
            metadata = {
                'video_ids': video_ids,
                'embedding_config': {
                    'model': self.config.model,
                    'dimension': self.config.dimension,
                    'primary_weight': self.config.primary_weight,
                    'anomaly_weight': self.config.anomaly_weight,
                    'categorical_weight': self.config.categorical_weight
                },
                'generation_stats': {
                    'total_requests': self.total_requests,
                    'failed_requests': self.failed_requests,
                    'total_embeddings': len(embeddings)
                }
            }
            
            with open(f"{save_path}_metadata.pkl", 'wb') as f:
                pickle.dump(metadata, f)
            
            self.logger.info(f"Embeddings saved to {save_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to save embeddings: {e}")
            raise
    
    def load_embeddings(self, load_path: str) -> Tuple[np.ndarray, List[str], Dict]:
        """Load embeddings and metadata from files"""
        try:
            # Load embeddings
            embeddings = np.load(f"{load_path}_embeddings.npy")
            
            # Load metadata
            with open(f"{load_path}_metadata.pkl", 'rb') as f:
                metadata = pickle.load(f)
            
            video_ids = metadata['video_ids']
            
            self.logger.info(f"Loaded {len(embeddings)} embeddings from {load_path}")
            return embeddings, video_ids, metadata
            
        except Exception as e:
            self.logger.error(f"Failed to load embeddings: {e}")
            raise
    
    def _save_intermediate_results(self, embeddings: np.ndarray, video_ids: List[str], 
                                  checkpoint_path: str):
        """Save intermediate results as checkpoint"""
        try:
            np.save(f"{checkpoint_path}.npy", embeddings)
            with open(f"{checkpoint_path}_ids.pkl", 'wb') as f:
                pickle.dump(video_ids, f)
            self.logger.info(f"Checkpoint saved: {checkpoint_path}")
        except Exception as e:
            self.logger.warning(f"Failed to save checkpoint: {e}")

def main():
    """Main function for standalone embedding generation"""
    import argparse
    from dotenv import load_dotenv
    
    # Load environment variables
    load_dotenv()
    
    parser = argparse.ArgumentParser(description='Generate video embeddings')
    parser.add_argument('--input', default=config.data_csv_path, 
                       help='Input CSV file path')
    parser.add_argument('--output', default='data/embeddings', 
                       help='Output path prefix for embeddings')
    parser.add_argument('--batch-size', type=int, default=100, 
                       help='Batch size for processing')
    parser.add_argument('--start-from', type=int, default=0, 
                       help='Start processing from this index')
    
    args = parser.parse_args()
    
    # Initialize OpenAI client
    client = OpenAI(api_key=config.openai.api_key)
    
    # Load video data
    print(f"Loading video data from {args.input}")
    video_data = pd.read_csv(args.input)
    print(f"Loaded {len(video_data)} videos")
    
    if args.start_from > 0:
        video_data = video_data.iloc[args.start_from:].reset_index(drop=True)
        print(f"Starting from index {args.start_from}, processing {len(video_data)} videos")
    
    # Initialize embedding generator
    embedding_config = EmbeddingConfig(batch_size=args.batch_size)
    generator = MultiLayeredEmbeddingGenerator(client, embedding_config)
    
    # Generate embeddings
    embeddings, video_ids = generator.generate_all_embeddings(
        video_data, args.output
    )
    
    print(f"Embedding generation completed!")
    print(f"Generated {len(embeddings)} embeddings with shape {embeddings.shape}")

if __name__ == "__main__":
    main()