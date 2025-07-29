import faiss
import numpy as np
import pandas as pd
import pickle
import logging
from typing import List, Tuple, Dict, Optional
import json
import time

from config.config import config

class FAISSVectorStore:
    def __init__(self, dimension: int = 3072, index_type: str = "IndexFlatIP"):
        self.dimension = dimension
        self.index_type = index_type
        self.index = None
        self.video_ids = []
        self.video_metadata = {}
        self.logger = logging.getLogger(__name__)
        
        self._initialize_index()
    
    def _initialize_index(self):
        """Initialize FAISS index based on configuration"""
        try:
            if self.index_type == "IndexFlatIP":
                # Inner product for cosine similarity (after L2 normalization)
                self.index = faiss.IndexFlatIP(self.dimension)
                self.logger.info(f"Initialized IndexFlatIP with dimension {self.dimension}")
                
            elif self.index_type == "IndexIVFFlat":
                # Faster search for large datasets
                quantizer = faiss.IndexFlatIP(self.dimension)
                self.index = faiss.IndexIVFFlat(
                    quantizer, self.dimension, 
                    config.vector_db.nlist
                )
                self.logger.info(f"Initialized IndexIVFFlat with {config.vector_db.nlist} clusters")
                
            elif self.index_type == "IndexIVFPQ":
                # Memory-efficient index for very large datasets
                quantizer = faiss.IndexFlatIP(self.dimension)
                self.index = faiss.IndexIVFPQ(
                    quantizer, self.dimension, 
                    config.vector_db.nlist, 
                    config.vector_db.m, 
                    config.vector_db.nbits
                )
                self.logger.info(f"Initialized IndexIVFPQ with {config.vector_db.nlist} clusters")
                
            else:
                raise ValueError(f"Unsupported index type: {self.index_type}")
                
        except Exception as e:
            self.logger.error(f"Failed to initialize FAISS index: {e}")
            raise
    
    def add_embeddings_batch(self, embeddings: np.ndarray, video_ids: List[str], 
                           metadata: List[Dict]):
        """Add embeddings in batch for efficiency"""
        try:
            if len(embeddings) != len(video_ids) or len(embeddings) != len(metadata):
                raise ValueError("Embeddings, video_ids, and metadata must have the same length")
            
            if embeddings.shape[1] != self.dimension:
                raise ValueError(f"Embedding dimension {embeddings.shape[1]} doesn't match index dimension {self.dimension}")
            
            # Ensure embeddings are normalized for cosine similarity
            faiss.normalize_L2(embeddings)
            
            # Train index if necessary (for IVF indices)
            if hasattr(self.index, 'is_trained') and not self.index.is_trained:
                if len(embeddings) >= config.vector_db.nlist:
                    self.logger.info("Training FAISS index...")
                    self.index.train(embeddings)
                else:
                    self.logger.warning(f"Not enough vectors to train index (need {config.vector_db.nlist}, got {len(embeddings)})")
            
            # Add to index
            start_time = time.time()
            self.index.add(embeddings)
            add_time = time.time() - start_time
            
            # Store metadata
            start_idx = len(self.video_ids)
            self.video_ids.extend(video_ids)
            for i, (video_id, meta) in enumerate(zip(video_ids, metadata)):
                # Add index information to metadata
                meta_with_index = meta.copy()
                meta_with_index['faiss_index'] = start_idx + i
                self.video_metadata[video_id] = meta_with_index
            
            self.logger.info(f"Added {len(video_ids)} embeddings to index in {add_time:.2f}s. Total: {self.index.ntotal}")
            
            # Set search parameters for IVF indices
            if hasattr(self.index, 'nprobe'):
                self.index.nprobe = config.vector_db.nprobe
            
        except Exception as e:
            self.logger.error(f"Error adding embeddings: {e}")
            raise
    
    def search_similar(self, query_embedding: np.ndarray, k: int = 50, 
                      threshold: float = 0.0) -> List[Tuple[str, float]]:
        """Search for similar videos"""
        try:
            if self.index.ntotal == 0:
                self.logger.warning("Index is empty, no results returned")
                return []
            
            # Normalize query
            query_norm = query_embedding.reshape(1, -1).astype(np.float32)
            faiss.normalize_L2(query_norm)
            
            # Ensure k doesn't exceed available vectors
            k = min(k, self.index.ntotal)
            
            # Search
            start_time = time.time()
            similarities, indices = self.index.search(query_norm, k)
            search_time = time.time() - start_time
            
            # Filter by threshold and return results
            results = []
            for sim, idx in zip(similarities[0], indices[0]):
                if idx != -1 and sim >= threshold and idx < len(self.video_ids):
                    results.append((self.video_ids[idx], float(sim)))
            
            self.logger.debug(f"Search completed in {search_time:.3f}s, found {len(results)} results above threshold {threshold}")
            
            return results
            
        except Exception as e:
            self.logger.error(f"Search error: {e}")
            return []
    
    def search_by_ids(self, video_ids: List[str]) -> List[Dict]:
        """Get metadata for specific video IDs"""
        try:
            results = []
            for video_id in video_ids:
                if video_id in self.video_metadata:
                    results.append(self.video_metadata[video_id])
                else:
                    self.logger.warning(f"Video ID {video_id} not found in metadata")
            
            return results
            
        except Exception as e:
            self.logger.error(f"Error searching by IDs: {e}")
            return []
    
    def get_embeddings_by_ids(self, video_ids: List[str]) -> np.ndarray:
        """Get embeddings for specific video IDs"""
        try:
            indices = []
            for video_id in video_ids:
                if video_id in self.video_metadata:
                    faiss_idx = self.video_metadata[video_id].get('faiss_index', -1)
                    if faiss_idx != -1:
                        indices.append(faiss_idx)
                else:
                    self.logger.warning(f"Video ID {video_id} not found")
            
            if not indices:
                return np.array([])
            
            # Reconstruct embeddings from index (if supported)
            if hasattr(self.index, 'reconstruct_batch'):
                embeddings = self.index.reconstruct_batch(indices)
                return embeddings
            else:
                self.logger.warning("Index doesn't support embedding reconstruction")
                return np.array([])
            
        except Exception as e:
            self.logger.error(f"Error getting embeddings by IDs: {e}")
            return np.array([])
    
    def get_statistics(self) -> Dict:
        """Get vector store statistics"""
        try:
            stats = {
                'total_vectors': int(self.index.ntotal) if self.index else 0,
                'dimension': self.dimension,
                'index_type': self.index_type,
                'total_video_ids': len(self.video_ids),
                'metadata_entries': len(self.video_metadata)
            }
            
            # Add index-specific statistics
            if hasattr(self.index, 'nlist'):
                stats['nlist'] = self.index.nlist
            if hasattr(self.index, 'nprobe'):
                stats['nprobe'] = self.index.nprobe
            if hasattr(self.index, 'is_trained'):
                stats['is_trained'] = self.index.is_trained
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Error getting statistics: {e}")
            return {'error': str(e)}
    
    def save_index(self, filepath: str):
        """Save FAISS index and metadata"""
        try:
            # Save FAISS index
            faiss.write_index(self.index, f"{filepath}.faiss")
            
            # Save metadata
            metadata_to_save = {
                'video_ids': self.video_ids,
                'video_metadata': self.video_metadata,
                'index_config': {
                    'dimension': self.dimension,
                    'index_type': self.index_type,
                    'total_vectors': self.index.ntotal
                },
                'creation_time': time.time(),
                'version': '1.0'
            }
            
            with open(f"{filepath}.metadata", 'wb') as f:
                pickle.dump(metadata_to_save, f)
            
            # Also save as JSON for human readability (without embeddings)
            json_metadata = {
                'index_config': metadata_to_save['index_config'],
                'creation_time': metadata_to_save['creation_time'],
                'version': metadata_to_save['version'],
                'statistics': self.get_statistics()
            }
            
            with open(f"{filepath}.json", 'w') as f:
                json.dump(json_metadata, f, indent=2)
            
            self.logger.info(f"Index and metadata saved to {filepath}")
            
        except Exception as e:
            self.logger.error(f"Error saving index: {e}")
            raise
    
    def load_index(self, filepath: str):
        """Load FAISS index and metadata"""
        try:
            # Load FAISS index
            self.index = faiss.read_index(f"{filepath}.faiss")
            
            # Load metadata
            with open(f"{filepath}.metadata", 'rb') as f:
                metadata = pickle.load(f)
                self.video_ids = metadata['video_ids']
                self.video_metadata = metadata['video_metadata']
                
                # Update configuration from saved data
                index_config = metadata['index_config']
                self.dimension = index_config['dimension']
                self.index_type = index_config['index_type']
            
            # Set search parameters for IVF indices
            if hasattr(self.index, 'nprobe'):
                self.index.nprobe = config.vector_db.nprobe
            
            self.logger.info(f"Index loaded from {filepath}. Total vectors: {self.index.ntotal}")
            self.logger.info(f"Configuration: {self.get_statistics()}")
            
        except Exception as e:
            self.logger.error(f"Error loading index: {e}")
            raise
    
    def optimize_index(self):
        """Optimize index for better search performance"""
        try:
            if self.index.ntotal == 0:
                self.logger.warning("Cannot optimize empty index")
                return
            
            self.logger.info("Optimizing FAISS index...")
            
            # For IVF indices, we can retrain if needed
            if hasattr(self.index, 'is_trained') and hasattr(self.index, 'train'):
                if not self.index.is_trained and self.index.ntotal >= config.vector_db.nlist:
                    # Get all vectors for retraining
                    all_vectors = np.array([self.index.reconstruct(i) for i in range(self.index.ntotal)])
                    self.index.train(all_vectors)
                    self.logger.info("Index retrained for optimization")
            
            # Set optimal search parameters
            if hasattr(self.index, 'nprobe'):
                # Adaptive nprobe based on index size
                optimal_nprobe = min(config.vector_db.nprobe, max(1, self.index.nlist // 10))
                self.index.nprobe = optimal_nprobe
                self.logger.info(f"Set nprobe to {optimal_nprobe}")
            
            self.logger.info("Index optimization completed")
            
        except Exception as e:
            self.logger.error(f"Error optimizing index: {e}")
    
    def remove_vectors(self, video_ids: List[str]):
        """Remove vectors by video IDs (if supported by index)"""
        try:
            if not hasattr(self.index, 'remove_ids'):
                self.logger.warning("Index type doesn't support vector removal")
                return False
            
            # Get FAISS indices for the video IDs
            faiss_indices = []
            for video_id in video_ids:
                if video_id in self.video_metadata:
                    faiss_idx = self.video_metadata[video_id].get('faiss_index', -1)
                    if faiss_idx != -1:
                        faiss_indices.append(faiss_idx)
            
            if not faiss_indices:
                self.logger.warning("No valid indices found for removal")
                return False
            
            # Remove from FAISS index
            self.index.remove_ids(np.array(faiss_indices, dtype=np.int64))
            
            # Remove from metadata
            for video_id in video_ids:
                if video_id in self.video_metadata:
                    del self.video_metadata[video_id]
                if video_id in self.video_ids:
                    self.video_ids.remove(video_id)
            
            self.logger.info(f"Removed {len(faiss_indices)} vectors")
            return True
            
        except Exception as e:
            self.logger.error(f"Error removing vectors: {e}")
            return False
    
    def update_metadata(self, video_id: str, new_metadata: Dict):
        """Update metadata for a specific video"""
        try:
            if video_id not in self.video_metadata:
                self.logger.warning(f"Video ID {video_id} not found for metadata update")
                return False
            
            # Preserve FAISS index information
            faiss_index = self.video_metadata[video_id].get('faiss_index', -1)
            updated_metadata = new_metadata.copy()
            updated_metadata['faiss_index'] = faiss_index
            
            self.video_metadata[video_id] = updated_metadata
            self.logger.debug(f"Updated metadata for video {video_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating metadata: {e}")
            return False
    
    def health_check(self) -> Dict:
        """Perform health check on the vector store"""
        try:
            health_status = {
                'status': 'healthy',
                'issues': [],
                'statistics': self.get_statistics(),
                'timestamp': time.time()
            }
            
            # Check index consistency
            if self.index is None:
                health_status['status'] = 'error'
                health_status['issues'].append('FAISS index is None')
                return health_status
            
            # Check vector count consistency
            if len(self.video_ids) != len(self.video_metadata):
                health_status['issues'].append('Video IDs and metadata count mismatch')
            
            if self.index.ntotal != len(self.video_ids):
                health_status['issues'].append('FAISS index count and video IDs count mismatch')
            
            # Check for missing metadata
            missing_metadata = 0
            for video_id in self.video_ids:
                if video_id not in self.video_metadata:
                    missing_metadata += 1
            
            if missing_metadata > 0:
                health_status['issues'].append(f'{missing_metadata} videos missing metadata')
            
            # Check index training status for IVF indices
            if hasattr(self.index, 'is_trained') and not self.index.is_trained:
                health_status['issues'].append('IVF index is not trained')
            
            # Set overall status based on issues
            if health_status['issues']:
                health_status['status'] = 'warning' if len(health_status['issues']) < 3 else 'error'
            
            return health_status
            
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
                'timestamp': time.time()
            }

def main():
    """Main function for standalone vector store operations"""
    import argparse
    from dotenv import load_dotenv
    
    load_dotenv()
    
    parser = argparse.ArgumentParser(description='Manage FAISS vector store')
    parser.add_argument('--action', choices=['create', 'load', 'search', 'stats', 'health'], 
                       required=True, help='Action to perform')
    parser.add_argument('--embeddings', help='Path to embeddings file (for create)')
    parser.add_argument('--video-data', help='Path to video data CSV (for create)')
    parser.add_argument('--index-path', default='data/faiss_index', 
                       help='Path to save/load index')
    parser.add_argument('--index-type', default='IndexFlatIP', 
                       choices=['IndexFlatIP', 'IndexIVFFlat', 'IndexIVFPQ'],
                       help='Type of FAISS index')
    parser.add_argument('--query', help='Query text for search')
    parser.add_argument('--k', type=int, default=10, help='Number of results for search')
    
    args = parser.parse_args()
    
    if args.action == 'create':
        if not args.embeddings or not args.video_data:
            print("Error: --embeddings and --video-data required for create action")
            return
        
        print(f"Creating FAISS index from {args.embeddings}")
        
        # Load embeddings
        embeddings = np.load(f"{args.embeddings}_embeddings.npy")
        with open(f"{args.embeddings}_metadata.pkl", 'rb') as f:
            emb_metadata = pickle.load(f)
        video_ids = emb_metadata['video_ids']
        
        # Load video data
        video_data = pd.read_csv(args.video_data)
        video_data = video_data.set_index('video_id').reindex(video_ids).reset_index()
        
        # Create metadata list
        metadata_list = []
        for _, row in video_data.iterrows():
            metadata_list.append(row.to_dict())
        
        # Initialize and populate vector store
        vector_store = FAISSVectorStore(
            dimension=embeddings.shape[1], 
            index_type=args.index_type
        )
        
        vector_store.add_embeddings_batch(embeddings, video_ids, metadata_list)
        vector_store.save_index(args.index_path)
        
        print(f"Index created and saved to {args.index_path}")
        print(f"Statistics: {vector_store.get_statistics()}")
    
    elif args.action == 'load':
        print(f"Loading FAISS index from {args.index_path}")
        vector_store = FAISSVectorStore()
        vector_store.load_index(args.index_path)
        print(f"Index loaded successfully")
        print(f"Statistics: {vector_store.get_statistics()}")
    
    elif args.action == 'stats':
        vector_store = FAISSVectorStore()
        vector_store.load_index(args.index_path)
        stats = vector_store.get_statistics()
        print("Vector Store Statistics:")
        for key, value in stats.items():
            print(f"  {key}: {value}")
    
    elif args.action == 'health':
        vector_store = FAISSVectorStore()
        vector_store.load_index(args.index_path)
        health = vector_store.health_check()
        print(f"Health Status: {health['status']}")
        if health['issues']:
            print("Issues:")
            for issue in health['issues']:
                print(f"  - {issue}")
        print(f"Statistics: {health['statistics']}")

if __name__ == "__main__":
    main()