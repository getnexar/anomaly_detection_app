import hdbscan
import numpy as np
import pandas as pd
import pickle
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from collections import Counter, defaultdict
from typing import Dict, List, Tuple, Optional
import json

from config.config import config

class IntelligentVideoClustering:
    def __init__(self, min_cluster_size: int = 50, min_samples: int = 10, 
                 cluster_selection_epsilon: float = 0.0):
        self.min_cluster_size = min_cluster_size
        self.min_samples = min_samples
        self.cluster_selection_epsilon = cluster_selection_epsilon
        
        # Initialize HDBSCAN with video-optimized parameters
        self.clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
            cluster_selection_epsilon=cluster_selection_epsilon,
            metric='euclidean',
            cluster_selection_method='eom',  # Excess of Mass
            algorithm='best',
            leaf_size=40
            # Note: n_jobs parameter removed due to compatibility issues with some HDBSCAN versions
        )
        
        self.cluster_labels_ = None
        self.cluster_info_ = {}
        self.fitted = False
        self.logger = logging.getLogger(__name__)
    
    def fit_predict_clusters(self, coordinates_3d: np.ndarray, 
                           video_data: pd.DataFrame) -> Tuple[np.ndarray, Dict]:
        """Perform clustering and generate intelligent labels"""
        try:
            self.logger.info(f"Starting HDBSCAN clustering for {len(coordinates_3d)} points")
            self.logger.info(f"Parameters: min_cluster_size={self.min_cluster_size}, min_samples={self.min_samples}")
            
            # Validate inputs
            if len(coordinates_3d) != len(video_data):
                raise ValueError(f"Coordinate count ({len(coordinates_3d)}) doesn't match video data count ({len(video_data)})")
            
            # Perform clustering
            self.cluster_labels_ = self.clusterer.fit_predict(coordinates_3d)
            self.fitted = True
            
            # Log clustering results
            unique_labels = set(self.cluster_labels_)
            n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
            n_noise = list(self.cluster_labels_).count(-1)
            
            self.logger.info(f"Clustering completed:")
            self.logger.info(f"  Found {n_clusters} clusters")
            self.logger.info(f"  Noise points: {n_noise} ({n_noise/len(self.cluster_labels_)*100:.1f}%)")
            
            # Generate cluster information
            self.cluster_info_ = self._generate_cluster_info(
                coordinates_3d, video_data, self.cluster_labels_
            )
            
            # Calculate clustering quality metrics
            quality_metrics = self._calculate_clustering_quality(coordinates_3d)
            
            result_dict = {
                'clusters': self.cluster_info_,
                'quality_metrics': quality_metrics,
                'noise_points': n_noise,
                'total_clusters': n_clusters,
                'clustering_stats': {
                    'total_points': len(self.cluster_labels_),
                    'clustered_points': len(self.cluster_labels_) - n_noise,
                    'noise_ratio': n_noise / len(self.cluster_labels_),
                    'avg_cluster_size': np.mean([info['size'] for info in self.cluster_info_.values()]) if self.cluster_info_ else 0
                }
            }
            
            self.logger.info(f"Generated information for {len(self.cluster_info_)} clusters")
            
            return self.cluster_labels_, result_dict
            
        except Exception as e:
            self.logger.error(f"Clustering failed: {e}")
            raise
    
    def _generate_cluster_info(self, coordinates_3d: np.ndarray, 
                             video_data: pd.DataFrame, 
                             cluster_labels: np.ndarray) -> Dict:
        """Generate comprehensive cluster information"""
        cluster_info = {}
        unique_clusters = set(cluster_labels)
        unique_clusters.discard(-1)  # Remove noise cluster
        
        self.logger.info(f"Generating information for {len(unique_clusters)} clusters")
        
        for cluster_id in unique_clusters:
            try:
                cluster_mask = cluster_labels == cluster_id
                cluster_videos = video_data[cluster_mask].copy()
                cluster_coords = coordinates_3d[cluster_mask]
                
                if len(cluster_videos) == 0:
                    continue
                
                self.logger.debug(f"Processing cluster {cluster_id} with {len(cluster_videos)} videos")
                
                # Generate intelligent cluster label
                cluster_label = self._generate_cluster_label(cluster_videos)
                
                # Calculate cluster statistics
                cluster_stats = self._calculate_cluster_statistics(
                    cluster_videos, cluster_coords
                )
                
                # Analyze dominant metadata patterns
                metadata_patterns = self._analyze_metadata_patterns(cluster_videos)
                
                # Extract top keywords and themes
                keywords_and_themes = self._extract_keywords_and_themes(cluster_videos)
                
                # Get representative samples
                sample_videos = self._get_representative_samples(cluster_videos, n=5)
                
                cluster_info[int(cluster_id)] = {
                    'cluster_id': int(cluster_id),
                    'label': cluster_label,
                    'size': int(cluster_mask.sum()),
                    'centroid': cluster_coords.mean(axis=0).tolist(),
                    'bounding_box': {
                        'min': cluster_coords.min(axis=0).tolist(),
                        'max': cluster_coords.max(axis=0).tolist()
                    },
                    'statistics': cluster_stats,
                    'metadata_patterns': metadata_patterns,
                    'keywords': keywords_and_themes['keywords'],
                    'themes': keywords_and_themes['themes'],
                    'sample_videos': sample_videos
                }
                
            except Exception as e:
                self.logger.error(f"Error processing cluster {cluster_id}: {e}")
                continue
        
        return cluster_info
    
    def _generate_cluster_label(self, cluster_videos: pd.DataFrame) -> str:
        """Generate intelligent cluster labels using multiple strategies"""
        try:
            # Strategy 1: TF-IDF on descriptions
            descriptions = cluster_videos['description-step-by-step'].fillna('').tolist()
            titles = cluster_videos['video-title'].fillna('').tolist()
            
            # Combine descriptions and titles
            combined_text = []
            for title, desc in zip(titles, descriptions):
                text = f"{title} {desc}".strip()
                if text:
                    combined_text.append(text)
            
            if not combined_text or all(not text.strip() for text in combined_text):
                return self._fallback_cluster_label(cluster_videos)
            
            # TF-IDF analysis
            try:
                vectorizer = TfidfVectorizer(
                    max_features=config.clustering.tfidf_max_features,
                    stop_words='english',
                    ngram_range=(1, 2),
                    min_df=config.clustering.min_keyword_frequency,
                    max_df=0.8  # Ignore very common terms
                )
                
                tfidf_matrix = vectorizer.fit_transform(combined_text)
                feature_names = vectorizer.get_feature_names_out()
                
                # Get top terms
                term_scores = tfidf_matrix.sum(axis=0).A1
                top_indices = term_scores.argsort()[-5:][::-1]
                top_terms = [feature_names[i] for i in top_indices if term_scores[i] > 0]
                
            except Exception as e:
                self.logger.warning(f"TF-IDF analysis failed: {e}")
                top_terms = []
            
            # Strategy 2: Metadata-based labeling
            metadata_label = self._generate_metadata_label(cluster_videos)
            
            # Combine strategies intelligently
            final_label = self._combine_label_strategies(top_terms, metadata_label)
            
            return final_label
            
        except Exception as e:
            self.logger.warning(f"Error generating cluster label: {e}")
            return self._fallback_cluster_label(cluster_videos)
    
    def _fallback_cluster_label(self, cluster_videos: pd.DataFrame) -> str:
        """Fallback cluster labeling based on metadata only"""
        try:
            # Use most common metadata values
            main_events = cluster_videos['main-event'].value_counts()
            locations = cluster_videos['location'].value_counts()
            
            event = main_events.index[0] if not main_events.empty else "unknown"
            location = locations.index[0] if not locations.empty else "location"
            
            # Clean up the labels
            event_clean = event.replace('-', ' ').replace('_', ' ')
            location_clean = location.replace('-', ' ').replace('_', ' ')
            
            return f"{event_clean} at {location_clean}"
            
        except Exception as e:
            self.logger.warning(f"Fallback labeling failed: {e}")
            return "mixed activities"
    
    def _generate_metadata_label(self, cluster_videos: pd.DataFrame) -> str:
        """Generate label based on dominant metadata patterns"""
        try:
            # Find most common combinations
            metadata_combos = []
            
            for _, row in cluster_videos.iterrows():
                event = str(row.get('main-event', 'unknown')).replace('-', ' ')
                location = str(row.get('location', 'unknown')).replace('-', ' ')
                combo = f"{event} {location}"
                metadata_combos.append(combo)
            
            if metadata_combos:
                most_common = Counter(metadata_combos).most_common(1)[0][0]
                return most_common
            
            return "mixed activities"
            
        except Exception as e:
            self.logger.warning(f"Metadata labeling failed: {e}")
            return "mixed activities"
    
    def _combine_label_strategies(self, tfidf_terms: List[str], 
                                metadata_label: str) -> str:
        """Intelligently combine TF-IDF and metadata-based labels"""
        try:
            # Clean and prioritize terms
            cleaned_terms = []
            for term in tfidf_terms[:3]:  # Top 3 terms
                if len(term) > 2 and not term.isdigit():  # Filter meaningful terms
                    cleaned_terms.append(term.lower())
            
            # Remove redundant terms that are already in metadata label
            metadata_words = set(metadata_label.lower().split())
            cleaned_terms = [term for term in cleaned_terms if term not in metadata_words]
            
            if cleaned_terms:
                if len(cleaned_terms) >= 2:
                    return f"{cleaned_terms[0]} {cleaned_terms[1]} scenarios"
                else:
                    # Combine single term with metadata
                    base_location = metadata_label.split()[-1] if len(metadata_label.split()) > 1 else "scenarios"
                    return f"{cleaned_terms[0]} {base_location}"
            
            # Enhance metadata label
            if "unknown" not in metadata_label:
                return metadata_label + " scenarios"
            else:
                return metadata_label
                
        except Exception as e:
            self.logger.warning(f"Label combination failed: {e}")
            return metadata_label
    
    def _calculate_cluster_statistics(self, cluster_videos: pd.DataFrame, 
                                    cluster_coords: np.ndarray) -> Dict:
        """Calculate comprehensive cluster statistics"""
        try:
            # Anomaly score statistics
            anomaly_scores = cluster_videos.get('anomaly_score', pd.Series([0] * len(cluster_videos)))
            
            # Coordinate statistics
            coord_variance = float(np.var(cluster_coords))
            coord_ranges = {
                'x_range': float(cluster_coords[:, 0].max() - cluster_coords[:, 0].min()),
                'y_range': float(cluster_coords[:, 1].max() - cluster_coords[:, 1].min()),
                'z_range': float(cluster_coords[:, 2].max() - cluster_coords[:, 2].min())
            }
            
            # Density calculation (points per unit volume)
            volume = max(coord_ranges['x_range'] * coord_ranges['y_range'] * coord_ranges['z_range'], 1e-6)
            density = len(cluster_videos) / volume
            
            return {
                'avg_anomaly_score': float(anomaly_scores.mean()),
                'anomaly_score_std': float(anomaly_scores.std()),
                'high_anomaly_count': int((anomaly_scores > 0.5).sum()),
                'coordinate_variance': coord_variance,
                'coordinate_ranges': coord_ranges,
                'density_score': float(density),
                'compactness': float(coord_variance / max(len(cluster_videos), 1))
            }
            
        except Exception as e:
            self.logger.warning(f"Error calculating cluster statistics: {e}")
            return {'error': str(e)}
    
    def _analyze_metadata_patterns(self, cluster_videos: pd.DataFrame) -> Dict:
        """Analyze dominant metadata patterns in cluster"""
        patterns = {}
        
        categorical_fields = [
            'main-event', 'location', 'zone', 'light-conditions', 
            'weather-conditions', 'type-of-vehicle-recording', 'video-quality'
        ]
        
        for field in categorical_fields:
            try:
                if field in cluster_videos.columns:
                    value_counts = cluster_videos[field].value_counts(normalize=True)
                    if not value_counts.empty:
                        patterns[field] = {
                            'dominant': str(value_counts.index[0]),
                            'dominance_ratio': float(value_counts.iloc[0]),
                            'distribution': {str(k): float(v) for k, v in value_counts.head(3).items()}
                        }
            except Exception as e:
                self.logger.warning(f"Error analyzing {field}: {e}")
                continue
        
        return patterns
    
    def _extract_keywords_and_themes(self, cluster_videos: pd.DataFrame) -> Dict:
        """Extract keywords and themes from cluster content"""
        try:
            # Combine all text content
            all_text = []
            text_fields = ['description-step-by-step', 'general-description', 'video-title']
            
            for field in text_fields:
                if field in cluster_videos.columns:
                    field_text = cluster_videos[field].fillna('').tolist()
                    all_text.extend([text for text in field_text if text.strip()])
            
            if not all_text:
                return {'keywords': [], 'themes': []}
            
            combined_text = ' '.join(all_text)
            
            # Extract keywords using TF-IDF
            try:
                vectorizer = TfidfVectorizer(
                    max_features=30,
                    stop_words='english',
                    ngram_range=(1, 3),
                    min_df=1,
                    max_df=0.9
                )
                
                tfidf_matrix = vectorizer.fit_transform([combined_text])
                feature_names = vectorizer.get_feature_names_out()
                scores = tfidf_matrix.toarray()[0]
                
                # Sort by score
                keyword_scores = list(zip(feature_names, scores))
                keyword_scores.sort(key=lambda x: x[1], reverse=True)
                
                keywords = [kw for kw, score in keyword_scores[:15] if score > 0]
                
                # Extract themes (longer phrases)
                themes = [kw for kw, score in keyword_scores if len(kw.split()) > 1 and score > 0][:10]
                
                return {
                    'keywords': keywords,
                    'themes': themes
                }
                
            except Exception as e:
                self.logger.warning(f"TF-IDF keyword extraction failed: {e}")
                return {'keywords': [], 'themes': []}
            
        except Exception as e:
            self.logger.warning(f"Error extracting keywords: {e}")
            return {'keywords': [], 'themes': []}
    
    def _get_representative_samples(self, cluster_videos: pd.DataFrame, 
                                  n: int = 5) -> List[Dict]:
        """Get representative sample videos from cluster"""
        try:
            if len(cluster_videos) <= n:
                sample_videos = cluster_videos
            else:
                # Sample based on anomaly scores and diversity
                if 'anomaly_score' in cluster_videos.columns:
                    high_anomaly = cluster_videos.nlargest(n//2, 'anomaly_score', keep='first')
                    low_anomaly = cluster_videos.nsmallest(n//2, 'anomaly_score', keep='first')
                    sample_videos = pd.concat([high_anomaly, low_anomaly]).drop_duplicates()
                else:
                    # Random sampling if no anomaly scores
                    sample_videos = cluster_videos.sample(n=min(n, len(cluster_videos)))
            
            samples = []
            for _, video in sample_videos.head(n).iterrows():
                samples.append({
                    'video_id': str(video.get('video_id', '')),
                    'title': str(video.get('video-title', '')),
                    'anomaly_score': float(video.get('anomaly_score', 0)),
                    'main_event': str(video.get('main-event', 'unknown'))
                })
            
            return samples
            
        except Exception as e:
            self.logger.warning(f"Error getting representative samples: {e}")
            return []
    
    def _calculate_clustering_quality(self, coordinates_3d: np.ndarray) -> Dict:
        """Calculate clustering quality metrics"""
        try:
            from sklearn.metrics import silhouette_score, calinski_harabasz_score
            
            if self.cluster_labels_ is None:
                return {'error': 'Clustering not completed'}
            
            # Filter out noise points for quality metrics
            non_noise_mask = self.cluster_labels_ != -1
            
            if non_noise_mask.sum() < 2:
                return {'error': 'Insufficient non-noise points for quality metrics'}
            
            non_noise_coords = coordinates_3d[non_noise_mask]
            non_noise_labels = self.cluster_labels_[non_noise_mask]
            
            # Calculate metrics
            try:
                silhouette = silhouette_score(non_noise_coords, non_noise_labels)
            except:
                silhouette = -1
                
            try:
                calinski_harabasz = calinski_harabasz_score(non_noise_coords, non_noise_labels)
            except:
                calinski_harabasz = -1
            
            # Basic statistics
            unique_labels = set(self.cluster_labels_)
            n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
            n_noise = int((self.cluster_labels_ == -1).sum())
            
            # Cluster size statistics
            cluster_sizes = []
            for label in unique_labels:
                if label != -1:
                    cluster_sizes.append(int((self.cluster_labels_ == label).sum()))
            
            return {
                'n_clusters': n_clusters,
                'n_noise_points': n_noise,
                'noise_ratio': float(n_noise / len(self.cluster_labels_)),
                'silhouette_score': float(silhouette),
                'calinski_harabasz_score': float(calinski_harabasz),
                'avg_cluster_size': float(np.mean(cluster_sizes)) if cluster_sizes else 0,
                'min_cluster_size': int(min(cluster_sizes)) if cluster_sizes else 0,
                'max_cluster_size': int(max(cluster_sizes)) if cluster_sizes else 0,
                'cluster_size_std': float(np.std(cluster_sizes)) if cluster_sizes else 0
            }
            
        except Exception as e:
            self.logger.warning(f"Error calculating clustering quality: {e}")
            return {'error': str(e)}
    
    def save_clustering_results(self, filepath: str, include_model: bool = True):
        """Save clustering results and optionally the model"""
        try:
            # Save cluster information
            with open(f"{filepath}_cluster_info.json", 'w') as f:
                json.dump(self.cluster_info_, f, indent=2)
            
            # Save cluster labels
            np.save(f"{filepath}_labels.npy", self.cluster_labels_)
            
            # Save model if requested
            if include_model and self.fitted:
                model_data = {
                    'clusterer': self.clusterer,
                    'cluster_labels': self.cluster_labels_,
                    'fitted': self.fitted,
                    'config': {
                        'min_cluster_size': self.min_cluster_size,
                        'min_samples': self.min_samples,
                        'cluster_selection_epsilon': self.cluster_selection_epsilon
                    }
                }
                
                with open(f"{filepath}_model.pkl", 'wb') as f:
                    pickle.dump(model_data, f)
            
            self.logger.info(f"Clustering results saved to {filepath}")
            
        except Exception as e:
            self.logger.error(f"Failed to save clustering results: {e}")
            raise
    
    def load_clustering_results(self, filepath: str, load_model: bool = True):
        """Load clustering results and optionally the model"""
        try:
            # Load cluster information
            with open(f"{filepath}_cluster_info.json", 'r') as f:
                self.cluster_info_ = json.load(f)
            
            # Load cluster labels
            self.cluster_labels_ = np.load(f"{filepath}_labels.npy")
            
            # Load model if requested
            if load_model:
                try:
                    with open(f"{filepath}_model.pkl", 'rb') as f:
                        model_data = pickle.load(f)
                    
                    self.clusterer = model_data['clusterer']
                    self.fitted = model_data['fitted']
                    
                    # Update configuration
                    config_data = model_data['config']
                    self.min_cluster_size = config_data['min_cluster_size']
                    self.min_samples = config_data['min_samples']
                    self.cluster_selection_epsilon = config_data['cluster_selection_epsilon']
                    
                except FileNotFoundError:
                    self.logger.warning("Model file not found, loading results only")
            
            self.logger.info(f"Clustering results loaded from {filepath}")
            
        except Exception as e:
            self.logger.error(f"Failed to load clustering results: {e}")
            raise

def main():
    """Main function for standalone clustering"""
    import argparse
    from dotenv import load_dotenv
    
    load_dotenv()
    
    parser = argparse.ArgumentParser(description='Cluster 3D video coordinates')
    parser.add_argument('--coordinates', required=True, 
                       help='Path to 3D coordinates file (without extension)')
    parser.add_argument('--video-data', required=True, 
                       help='Path to video data CSV file')
    parser.add_argument('--output', default='data/clustering', 
                       help='Output path prefix')
    parser.add_argument('--min-cluster-size', type=int, default=50, 
                       help='Minimum cluster size')
    parser.add_argument('--min-samples', type=int, default=10, 
                       help='Minimum samples parameter')
    
    args = parser.parse_args()
    
    # Load 3D coordinates
    print(f"Loading coordinates from {args.coordinates}")
    coordinates = np.load(f"{args.coordinates}_coordinates.npy")
    
    with open(f"{args.coordinates}_metadata.pkl", 'rb') as f:
        coord_metadata = pickle.load(f)
    video_ids = coord_metadata['video_ids']
    
    # Load video data
    print(f"Loading video data from {args.video_data}")
    video_data = pd.read_csv(args.video_data)
    
    # Filter video data to match coordinates
    video_data = video_data[video_data['video_id'].isin(video_ids)].copy()
    video_data = video_data.set_index('video_id').reindex(video_ids).reset_index()
    
    print(f"Loaded {len(coordinates)} coordinates and {len(video_data)} video records")
    
    # Initialize clustering
    clustering = IntelligentVideoClustering(
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples
    )
    
    # Perform clustering
    print("Starting clustering...")
    cluster_labels, results = clustering.fit_predict_clusters(coordinates, video_data)
    
    # Save results
    clustering.save_clustering_results(args.output)
    
    print(f"Clustering completed!")
    print(f"Found {results['total_clusters']} clusters")
    print(f"Noise points: {results['noise_points']} ({results['clustering_stats']['noise_ratio']*100:.1f}%)")
    
    # Print cluster summary
    for cluster_id, info in results['clusters'].items():
        print(f"Cluster {cluster_id}: {info['label']} ({info['size']} videos)")

if __name__ == "__main__":
    main()