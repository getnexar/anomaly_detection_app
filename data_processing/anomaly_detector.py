import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from typing import Dict, List, Tuple, Optional
import re
import logging
import pickle

from config.config import config

class AdvancedAnomalyDetector:
    def __init__(self, contamination: float = 0.1, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state
        
        # Initialize models
        self.isolation_forest = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=config.anomaly.n_estimators,
            max_samples=config.anomaly.max_samples,
            max_features=config.anomaly.max_features,
            bootstrap=config.anomaly.bootstrap,
            n_jobs=config.anomaly.n_jobs
        )
        
        self.scaler = StandardScaler()
        self.fitted = False
        self.logger = logging.getLogger(__name__)
        
        # Anomaly keywords with severity weights
        self.anomaly_keywords = config.anomaly.anomaly_keywords
        self.normal_indicators = config.anomaly.normal_indicators
        
        # Score combination weights
        self.embedding_weight = config.anomaly.embedding_weight
        self.text_weight = config.anomaly.text_weight
        self.metadata_weight = config.anomaly.metadata_weight
        self.statistical_weight = config.anomaly.statistical_weight
        
        # Storage for detailed explanations
        self.anomaly_explanations = {}
    
    def detect_anomalies(self, embeddings: np.ndarray, 
                        video_data: pd.DataFrame) -> np.ndarray:
        """Comprehensive anomaly detection using multiple methods"""
        try:
            self.logger.info(f"Starting anomaly detection for {len(embeddings)} videos")
            
            # Validate inputs
            if len(embeddings) != len(video_data):
                raise ValueError(f"Embedding count ({len(embeddings)}) doesn't match video data count ({len(video_data)})")
            
            # Method 1: Embedding-based anomaly detection (Isolation Forest)
            self.logger.info("Running embedding-based anomaly detection...")
            embedding_scores = self._detect_embedding_anomalies(embeddings)
            
            # Method 2: Text-based anomaly detection
            self.logger.info("Running text-based anomaly detection...")
            text_scores = self._detect_text_anomalies(video_data)
            
            # Method 3: Metadata-based anomaly detection
            self.logger.info("Running metadata-based anomaly detection...")
            metadata_scores = self._detect_metadata_anomalies(video_data)
            
            # Method 4: Statistical anomaly detection
            self.logger.info("Running statistical anomaly detection...")
            statistical_scores = self._detect_statistical_anomalies(video_data)
            
            # Combine scores with weighted approach
            self.logger.info("Combining anomaly scores...")
            final_scores = self._combine_anomaly_scores(
                embedding_scores, text_scores, metadata_scores, statistical_scores
            )
            
            # Store detailed anomaly information
            self._generate_anomaly_explanations(
                video_data, embedding_scores, text_scores, 
                metadata_scores, statistical_scores, final_scores
            )
            
            self.fitted = True
            
            # Log statistics
            high_anomalies = (final_scores > 0.5).sum()
            self.logger.info(f"Anomaly detection completed:")
            self.logger.info(f"  High anomalies (>0.5): {high_anomalies} ({high_anomalies/len(final_scores)*100:.1f}%)")
            self.logger.info(f"  Mean anomaly score: {final_scores.mean():.3f}")
            self.logger.info(f"  Max anomaly score: {final_scores.max():.3f}")
            
            return final_scores
            
        except Exception as e:
            self.logger.error(f"Anomaly detection failed: {e}")
            raise
    
    def _detect_embedding_anomalies(self, embeddings: np.ndarray) -> np.ndarray:
        """Detect anomalies using Isolation Forest on embeddings"""
        try:
            # Normalize embeddings
            embeddings_scaled = self.scaler.fit_transform(embeddings)
            
            # Fit Isolation Forest
            anomaly_labels = self.isolation_forest.fit_predict(embeddings_scaled)
            
            # Get anomaly scores (lower scores = more anomalous)
            anomaly_scores = self.isolation_forest.decision_function(embeddings_scaled)
            
            # Convert to 0-1 scale (higher = more anomalous)
            # Isolation Forest returns negative scores for anomalies
            normalized_scores = (anomaly_scores.max() - anomaly_scores) / (anomaly_scores.max() - anomaly_scores.min() + 1e-8)
            
            # Apply contamination threshold
            threshold = np.percentile(normalized_scores, (1 - self.contamination) * 100)
            embedding_anomaly_scores = np.where(normalized_scores > threshold, normalized_scores, 0)
            
            self.logger.info(f"Embedding anomalies detected: {(embedding_anomaly_scores > 0).sum()}")
            
            return embedding_anomaly_scores
            
        except Exception as e:
            self.logger.error(f"Embedding anomaly detection failed: {e}")
            return np.zeros(len(embeddings))
    
    def _detect_text_anomalies(self, video_data: pd.DataFrame) -> np.ndarray:
        """Detect anomalies using text analysis of interpretations"""
        text_scores = []
        
        for _, row in video_data.iterrows():
            score = 0.0
            interpretation = str(row.get('interpretation', '')).lower()
            description = str(row.get('description-step-by-step', '')).lower()
            
            # Check for normal indicators (reduce score)
            normal_penalty = 0.0
            for normal_phrase in self.normal_indicators:
                if normal_phrase in interpretation:
                    normal_penalty += 0.3
                    break  # Only apply penalty once
            
            # Check for anomaly keywords
            anomaly_boost = 0.0
            found_keywords = []
            for keyword, weight in self.anomaly_keywords.items():
                if keyword in interpretation or keyword in description:
                    anomaly_boost += weight
                    found_keywords.append(keyword)
            
            # Length-based scoring (very short or very long interpretations might be anomalous)
            length_score = 0.0
            if len(interpretation) < 20:  # Very short
                length_score = 0.2
            elif len(interpretation) > 200:  # Very long (detailed analysis)
                length_score = 0.3
            
            # Pattern-based detection
            pattern_score = 0.0
            # Multiple exclamation marks or caps
            if re.search(r'[!]{2,}|[A-Z]{5,}', interpretation):
                pattern_score += 0.2
            
            # Combine scores
            final_score = max(0, anomaly_boost + length_score + pattern_score - normal_penalty)
            text_scores.append(min(1.0, final_score))  # Cap at 1.0
        
        text_scores_array = np.array(text_scores)
        self.logger.info(f"Text anomalies detected: {(text_scores_array > 0.3).sum()}")
        
        return text_scores_array
    
    def _detect_metadata_anomalies(self, video_data: pd.DataFrame) -> np.ndarray:
        """Detect anomalies based on metadata patterns"""
        metadata_scores = []
        
        # Calculate expected patterns for each metadata field
        field_distributions = {}
        metadata_fields = ['main-event', 'location', 'zone', 'light-conditions', 
                          'weather-conditions', 'video-quality']
        
        for field in metadata_fields:
            if field in video_data.columns:
                field_distributions[field] = video_data[field].value_counts(normalize=True)
        
        for _, row in video_data.iterrows():
            score = 0.0
            
            # Check for rare metadata combinations
            for field in metadata_fields:
                if field in row and field in field_distributions:
                    value = row[field]
                    if pd.notna(value):
                        # Rarity score (rare values get higher scores)
                        frequency = field_distributions[field].get(value, 0)
                        if frequency < 0.05:  # Less than 5% of data
                            score += 0.3
                        elif frequency < 0.01:  # Less than 1% of data
                            score += 0.5
            
            # Special combinations that are inherently more likely to be anomalous
            event = str(row.get('main-event', '')).lower()
            location = str(row.get('location', '')).lower()
            weather = str(row.get('weather-conditions', '')).lower()
            light = str(row.get('light-conditions', '')).lower()
            quality = str(row.get('video-quality', '')).lower()
            
            # Dangerous combinations
            if 'accident' in event:
                score += 0.6
            if 'abrupt' in event:
                score += 0.4
            if weather in ['rain', 'snow', 'storm', 'fog']:
                score += 0.2
            if light in ['dark', 'bright-glare']:
                score += 0.1
            if 'corrupted' in quality or 'low' in quality:
                score += 0.2
            
            # Unusual location-event combinations
            unusual_combinations = [
                ('parking-lot', 'highway'),
                ('intersection', 'parking'),
                ('rural', 'traffic-lights')
            ]
            
            for loc_term, event_term in unusual_combinations:
                if loc_term in location and event_term in event:
                    score += 0.3
            
            metadata_scores.append(min(1.0, score))
        
        metadata_scores_array = np.array(metadata_scores)
        self.logger.info(f"Metadata anomalies detected: {(metadata_scores_array > 0.3).sum()}")
        
        return metadata_scores_array
    
    def _detect_statistical_anomalies(self, video_data: pd.DataFrame) -> np.ndarray:
        """Detect statistical anomalies in numerical features"""
        statistical_scores = []
        
        # Analyze numerical fields if available
        numerical_fields = ['Input tokens count', 'Output tokens count', 'Total tokens count']
        
        # Check if any numerical fields exist
        available_fields = [field for field in numerical_fields if field in video_data.columns]
        
        if not available_fields:
            self.logger.info("No numerical fields available for statistical anomaly detection")
            return np.zeros(len(video_data))
        
        for _, row in video_data.iterrows():
            score = 0.0
            
            # Token count anomalies (very high or very low)
            for field in available_fields:
                if field in row and pd.notna(row[field]):
                    try:
                        value = float(row[field])
                        
                        # Calculate z-score if we have the distribution
                        if field in video_data.columns:
                            field_data = pd.to_numeric(video_data[field], errors='coerce').dropna()
                            
                            if len(field_data) > 1:
                                mean_val = field_data.mean()
                                std_val = field_data.std()
                                
                                if std_val > 0:
                                    z_score = abs(value - mean_val) / std_val
                                    if z_score > 3:  # 3 standard deviations
                                        score += 0.3
                                    elif z_score > 2:  # 2 standard deviations
                                        score += 0.2
                    except (ValueError, TypeError):
                        continue
            
            statistical_scores.append(min(1.0, score))
        
        statistical_scores_array = np.array(statistical_scores)
        self.logger.info(f"Statistical anomalies detected: {(statistical_scores_array > 0.2).sum()}")
        
        return statistical_scores_array
    
    def _combine_anomaly_scores(self, embedding_scores: np.ndarray, 
                              text_scores: np.ndarray,
                              metadata_scores: np.ndarray,
                              statistical_scores: np.ndarray) -> np.ndarray:
        """Combine different anomaly detection methods"""
        # Weighted combination
        combined_scores = (
            self.embedding_weight * embedding_scores +
            self.text_weight * text_scores +
            self.metadata_weight * metadata_scores +
            self.statistical_weight * statistical_scores
        )
        
        # Apply non-linear transformation to emphasize high scores
        combined_scores = np.power(combined_scores, 1.2)
        
        # Normalize to 0-1 range
        if combined_scores.max() > combined_scores.min():
            combined_scores = (combined_scores - combined_scores.min()) / (combined_scores.max() - combined_scores.min())
        
        return combined_scores
    
    def _generate_anomaly_explanations(self, video_data: pd.DataFrame,
                                     embedding_scores: np.ndarray,
                                     text_scores: np.ndarray,
                                     metadata_scores: np.ndarray,
                                     statistical_scores: np.ndarray,
                                     final_scores: np.ndarray):
        """Generate explanations for anomaly scores"""
        self.anomaly_explanations = {}
        
        self.logger.info("Generating anomaly explanations...")
        
        for idx, (_, row) in enumerate(video_data.iterrows()):
            video_id = row.get('video_id', str(idx))
            reasons = []
            
            # Embedding-based reasons
            if embedding_scores[idx] > 0.3:
                reasons.append(f"Embedding analysis shows high dissimilarity to normal patterns (score: {embedding_scores[idx]:.3f})")
            
            # Text-based reasons
            if text_scores[idx] > 0.3:
                interpretation = str(row.get('interpretation', '')).lower()
                found_keywords = [kw for kw in self.anomaly_keywords.keys() if kw in interpretation]
                if found_keywords:
                    reasons.append(f"Anomaly keywords detected: {', '.join(found_keywords[:3])}")
                else:
                    reasons.append(f"Text analysis indicates unusual content (score: {text_scores[idx]:.3f})")
            
            # Metadata-based reasons
            if metadata_scores[idx] > 0.3:
                # Identify specific metadata anomalies
                event = str(row.get('main-event', 'unknown'))
                location = str(row.get('location', 'unknown'))
                weather = str(row.get('weather-conditions', 'unknown'))
                
                if 'accident' in event.lower():
                    reasons.append("Event type indicates accident or collision")
                elif 'abrupt' in event.lower():
                    reasons.append("Event involves abrupt driving behavior")
                
                if weather.lower() in ['rain', 'snow', 'storm']:
                    reasons.append(f"Adverse weather conditions: {weather}")
                
                if metadata_scores[idx] > 0.5:
                    reasons.append(f"Unusual metadata combination detected (score: {metadata_scores[idx]:.3f})")
            
            # Statistical reasons
            if statistical_scores[idx] > 0.2:
                reasons.append(f"Statistical outlier in numerical features (score: {statistical_scores[idx]:.3f})")
            
            # Overall assessment
            if final_scores[idx] > 0.7:
                severity = "High"
            elif final_scores[idx] > 0.4:
                severity = "Medium"
            else:
                severity = "Low"
            
            self.anomaly_explanations[str(video_id)] = {
                'final_score': float(final_scores[idx]),
                'severity': severity,
                'component_scores': {
                    'embedding': float(embedding_scores[idx]),
                    'text': float(text_scores[idx]),
                    'metadata': float(metadata_scores[idx]),
                    'statistical': float(statistical_scores[idx])
                },
                'reasons': reasons,
                'is_anomaly': final_scores[idx] > 0.5,
                'confidence': min(1.0, len(reasons) / 3.0)  # Higher confidence with more reasons
            }
        
        self.logger.info(f"Generated explanations for {len(self.anomaly_explanations)} videos")
    
    def get_anomaly_explanation(self, video_id: str) -> Optional[Dict]:
        """Get anomaly explanation for specific video"""
        return self.anomaly_explanations.get(str(video_id))
    
    def get_top_anomalies(self, n: int = 100, min_score: float = 0.0) -> List[Tuple[str, float, List[str]]]:
        """Get top N anomalies with explanations"""
        if not hasattr(self, 'anomaly_explanations') or not self.anomaly_explanations:
            return []
        
        # Filter by minimum score and sort by anomaly score
        filtered_anomalies = {
            vid: data for vid, data in self.anomaly_explanations.items() 
            if data['final_score'] >= min_score
        }
        
        sorted_anomalies = sorted(
            filtered_anomalies.items(),
            key=lambda x: x[1]['final_score'],
            reverse=True
        )
        
        return [(video_id, data['final_score'], data['reasons']) 
                for video_id, data in sorted_anomalies[:n]]
    
    def get_anomaly_statistics(self) -> Dict:
        """Get comprehensive anomaly detection statistics"""
        if not self.anomaly_explanations:
            return {'error': 'No anomaly analysis available'}
        
        scores = [data['final_score'] for data in self.anomaly_explanations.values()]
        severities = [data['severity'] for data in self.anomaly_explanations.values()]
        
        return {
            'total_videos': len(self.anomaly_explanations),
            'high_anomalies': sum(1 for s in severities if s == 'High'),
            'medium_anomalies': sum(1 for s in severities if s == 'Medium'),
            'low_anomalies': sum(1 for s in severities if s == 'Low'),
            'mean_score': float(np.mean(scores)),
            'median_score': float(np.median(scores)),
            'max_score': float(np.max(scores)),
            'min_score': float(np.min(scores)),
            'std_score': float(np.std(scores)),
            'anomaly_rate': sum(1 for data in self.anomaly_explanations.values() if data['is_anomaly']) / len(self.anomaly_explanations)
        }
    
    def save_anomaly_results(self, filepath: str):
        """Save anomaly detection results"""
        try:
            save_data = {
                'anomaly_explanations': self.anomaly_explanations,
                'fitted': self.fitted,
                'config': {
                    'contamination': self.contamination,
                    'embedding_weight': self.embedding_weight,
                    'text_weight': self.text_weight,
                    'metadata_weight': self.metadata_weight,
                    'statistical_weight': self.statistical_weight
                },
                'statistics': self.get_anomaly_statistics()
            }
            
            with open(filepath, 'wb') as f:
                pickle.dump(save_data, f)
            
            self.logger.info(f"Anomaly results saved to {filepath}")
            
        except Exception as e:
            self.logger.error(f"Failed to save anomaly results: {e}")
            raise
    
    def load_anomaly_results(self, filepath: str):
        """Load anomaly detection results"""
        try:
            with open(filepath, 'rb') as f:
                save_data = pickle.load(f)
            
            self.anomaly_explanations = save_data['anomaly_explanations']
            self.fitted = save_data['fitted']
            
            # Update configuration if available
            if 'config' in save_data:
                config_data = save_data['config']
                self.contamination = config_data.get('contamination', self.contamination)
                self.embedding_weight = config_data.get('embedding_weight', self.embedding_weight)
                self.text_weight = config_data.get('text_weight', self.text_weight)
                self.metadata_weight = config_data.get('metadata_weight', self.metadata_weight)
                self.statistical_weight = config_data.get('statistical_weight', self.statistical_weight)
            
            self.logger.info(f"Anomaly results loaded from {filepath}")
            self.logger.info(f"Statistics: {save_data.get('statistics', {})}")
            
        except Exception as e:
            self.logger.error(f"Failed to load anomaly results: {e}")
            raise

def main():
    """Main function for standalone anomaly detection"""
    import argparse
    from dotenv import load_dotenv
    
    load_dotenv()
    
    parser = argparse.ArgumentParser(description='Detect video anomalies')
    parser.add_argument('--embeddings', required=True, 
                       help='Path to embeddings file (without extension)')
    parser.add_argument('--video-data', required=True, 
                       help='Path to video data CSV file')
    parser.add_argument('--output', default='data/anomalies', 
                       help='Output path for anomaly results')
    parser.add_argument('--contamination', type=float, default=0.1, 
                       help='Expected proportion of anomalies')
    parser.add_argument('--top-k', type=int, default=50, 
                       help='Number of top anomalies to display')
    
    args = parser.parse_args()
    
    # Load embeddings
    print(f"Loading embeddings from {args.embeddings}")
    embeddings = np.load(f"{args.embeddings}_embeddings.npy")
    
    with open(f"{args.embeddings}_metadata.pkl", 'rb') as f:
        metadata = pickle.load(f)
    video_ids = metadata['video_ids']
    
    # Load video data
    print(f"Loading video data from {args.video_data}")
    video_data = pd.read_csv(args.video_data)
    
    # Filter and align data
    video_data = video_data[video_data['video_id'].isin(video_ids)].copy()
    video_data = video_data.set_index('video_id').reindex(video_ids).reset_index()
    
    print(f"Loaded {len(embeddings)} embeddings and {len(video_data)} video records")
    
    # Initialize anomaly detector
    detector = AdvancedAnomalyDetector(contamination=args.contamination)
    
    # Detect anomalies
    print("Starting anomaly detection...")
    anomaly_scores = detector.detect_anomalies(embeddings, video_data)
    
    # Save results
    detector.save_anomaly_results(f"{args.output}.pkl")
    
    # Get statistics
    stats = detector.get_anomaly_statistics()
    print(f"\nAnomaly Detection Results:")
    print(f"  Total videos: {stats['total_videos']}")
    print(f"  High anomalies: {stats['high_anomalies']}")
    print(f"  Medium anomalies: {stats['medium_anomalies']}")
    print(f"  Low anomalies: {stats['low_anomalies']}")
    print(f"  Anomaly rate: {stats['anomaly_rate']*100:.1f}%")
    print(f"  Mean score: {stats['mean_score']:.3f}")
    print(f"  Max score: {stats['max_score']:.3f}")
    
    # Show top anomalies
    print(f"\nTop {args.top_k} Anomalies:")
    top_anomalies = detector.get_top_anomalies(args.top_k)
    
    for i, (video_id, score, reasons) in enumerate(top_anomalies, 1):
        print(f"{i}. Video {video_id} (score: {score:.3f})")
        for reason in reasons[:2]:  # Show top 2 reasons
            print(f"   - {reason}")
        print()

if __name__ == "__main__":
    main()