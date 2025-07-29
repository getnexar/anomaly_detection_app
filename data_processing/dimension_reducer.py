import umap
import numpy as np
import pandas as pd
import pickle
import logging
from sklearn.preprocessing import StandardScaler
from typing import Optional, Tuple, Dict, List
from scipy.stats import spearmanr
from sklearn.metrics import pairwise_distances

from config.config import config

class UMAPDimensionReducer:
    def __init__(self, n_components: int = 3, n_neighbors: int = 15, 
                 min_dist: float = 0.1, metric: str = 'cosine', 
                 random_state: int = 42):
        self.n_components = n_components
        self.n_neighbors = n_neighbors
        self.min_dist = min_dist
        self.metric = metric
        self.random_state = random_state
        
        self.reducer = None
        self.scaler = StandardScaler()
        self.fitted = False
        self.logger = logging.getLogger(__name__)
        
        # Initialize UMAP with optimized parameters for video data
        self._initialize_reducer()
    
    def _initialize_reducer(self):
        """Initialize UMAP reducer with video-optimized parameters"""
        self.reducer = umap.UMAP(
            n_components=self.n_components,
            n_neighbors=self.n_neighbors,
            min_dist=self.min_dist,
            metric=self.metric,
            random_state=self.random_state,
            # Video-specific optimizations
            spread=config.umap.spread,
            local_connectivity=config.umap.local_connectivity,
            repulsion_strength=config.umap.repulsion_strength,
            negative_sample_rate=config.umap.negative_sample_rate,
            transform_queue_size=config.umap.transform_queue_size,
            # Performance optimizations
            low_memory=config.umap.low_memory,
            n_jobs=config.umap.n_jobs,
            verbose=config.umap.verbose
        )
    
    def fit_transform_embeddings(self, embeddings: np.ndarray, 
                                video_ids: List[str]) -> Tuple[np.ndarray, Dict]:
        """Fit UMAP and transform embeddings to 3D coordinates"""
        try:
            self.logger.info(f"Starting UMAP reduction for {len(embeddings)} embeddings")
            self.logger.info(f"Input dimension: {embeddings.shape[1]}, Output dimension: {self.n_components}")
            
            # Validate input
            if len(embeddings) == 0:
                raise ValueError("No embeddings provided")
            
            if embeddings.shape[1] != config.openai.dimension:
                self.logger.warning(f"Unexpected embedding dimension: {embeddings.shape[1]}")
            
            # Apply UMAP reduction
            coords_3d = self.reducer.fit_transform(embeddings)
            self.fitted = True
            
            self.logger.info(f"UMAP reduction completed. Output shape: {coords_3d.shape}")
            
            # Post-process coordinates for better visualization
            coords_3d = self._postprocess_coordinates(coords_3d)
            
            # Generate quality metrics
            quality_metrics = self._calculate_quality_metrics(embeddings, coords_3d)
            
            self.logger.info("UMAP reduction completed successfully")
            self.logger.info(f"Quality metrics: {quality_metrics.get('reduction_quality', 'unknown')}")
            
            return coords_3d, quality_metrics
            
        except Exception as e:
            self.logger.error(f"UMAP reduction failed: {e}")
            raise
    
    def _postprocess_coordinates(self, coords_3d: np.ndarray) -> np.ndarray:
        """Post-process 3D coordinates for optimal visualization"""
        self.logger.info("Post-processing coordinates for visualization")
        
        # Center coordinates around origin
        coords_centered = coords_3d - coords_3d.mean(axis=0)
        
        # Scale to reasonable range for Three.js (typically -10 to 10)
        coords_scaled = self.scaler.fit_transform(coords_centered)
        coords_scaled *= 8  # Scale factor for good visualization spread
        
        # Ensure no extreme outliers that could break visualization
        coords_clipped = np.clip(coords_scaled, -15, 15)
        
        # Log coordinate statistics
        ranges = coords_clipped.max(axis=0) - coords_clipped.min(axis=0)
        self.logger.info(f"Final coordinate ranges: X={ranges[0]:.2f}, Y={ranges[1]:.2f}, Z={ranges[2]:.2f}")
        
        return coords_clipped
    
    def _calculate_quality_metrics(self, original_embeddings: np.ndarray, 
                                  coords_3d: np.ndarray) -> Dict:
        """Calculate reduction quality metrics"""
        try:
            self.logger.info("Calculating quality metrics for UMAP reduction")
            
            # Sample subset for performance (use up to 5000 points)
            n_sample = min(5000, len(original_embeddings))
            if n_sample < len(original_embeddings):
                indices = np.random.choice(len(original_embeddings), n_sample, replace=False)
                sample_original = original_embeddings[indices]
                sample_reduced = coords_3d[indices]
            else:
                sample_original = original_embeddings
                sample_reduced = coords_3d
            
            # Calculate pairwise distances in both spaces
            self.logger.info("Computing pairwise distances for quality assessment")
            original_distances = pairwise_distances(
                sample_original, metric='cosine'
            ).flatten()
            
            reduced_distances = pairwise_distances(
                sample_reduced, metric='euclidean'
            ).flatten()
            
            # Spearman correlation (rank correlation)
            correlation, p_value = spearmanr(original_distances, reduced_distances)
            
            # Calculate spread metrics
            coord_ranges = coords_3d.max(axis=0) - coords_3d.min(axis=0)
            coord_means = coords_3d.mean(axis=0)
            coord_stds = coords_3d.std(axis=0)
            
            # Calculate density metrics
            total_variance = np.var(coords_3d)
            per_axis_variance = np.var(coords_3d, axis=0)
            
            # Determine quality rating
            if correlation > 0.6:
                quality_rating = 'excellent'
            elif correlation > 0.4:
                quality_rating = 'good'
            elif correlation > 0.2:
                quality_rating = 'moderate'
            else:
                quality_rating = 'poor'
            
            metrics = {
                'distance_correlation': float(correlation),
                'correlation_p_value': float(p_value),
                'coordinate_ranges': coord_ranges.tolist(),
                'coordinate_means': coord_means.tolist(),
                'coordinate_stds': coord_stds.tolist(),
                'total_variance': float(total_variance),
                'per_axis_variance': per_axis_variance.tolist(),
                'n_samples_processed': len(original_embeddings),
                'n_samples_for_quality': n_sample,
                'reduction_quality': quality_rating,
                'umap_parameters': {
                    'n_neighbors': self.n_neighbors,
                    'min_dist': self.min_dist,
                    'metric': self.metric,
                    'n_components': self.n_components
                }
            }
            
            self.logger.info(f"Quality assessment completed:")
            self.logger.info(f"  Distance correlation: {correlation:.3f}")
            self.logger.info(f"  Quality rating: {quality_rating}")
            self.logger.info(f"  Total variance: {total_variance:.3f}")
            
            return metrics
            
        except Exception as e:
            self.logger.warning(f"Could not calculate quality metrics: {e}")
            return {
                'error': str(e),
                'n_samples_processed': len(original_embeddings),
                'coordinate_ranges': (coords_3d.max(axis=0) - coords_3d.min(axis=0)).tolist() if len(coords_3d) > 0 else [0, 0, 0]
            }
    
    def transform_new_embeddings(self, new_embeddings: np.ndarray) -> np.ndarray:
        """Transform new embeddings using fitted UMAP"""
        if not self.fitted:
            raise ValueError("UMAP must be fitted before transforming new embeddings")
        
        try:
            self.logger.info(f"Transforming {len(new_embeddings)} new embeddings")
            new_coords = self.reducer.transform(new_embeddings)
            
            # Apply same post-processing as original data
            new_coords_centered = new_coords - new_coords.mean(axis=0)
            new_coords_scaled = self.scaler.transform(new_coords_centered)
            new_coords_clipped = np.clip(new_coords_scaled, -15, 15)
            
            return new_coords_clipped
            
        except Exception as e:
            self.logger.error(f"Error transforming new embeddings: {e}")
            raise
    
    def save_reducer(self, filepath: str):
        """Save fitted UMAP reducer and scaler"""
        if not self.fitted:
            raise ValueError("Cannot save unfitted reducer")
        
        try:
            save_data = {
                'reducer': self.reducer,
                'scaler': self.scaler,
                'fitted': self.fitted,
                'config': {
                    'n_components': self.n_components,
                    'n_neighbors': self.n_neighbors,
                    'min_dist': self.min_dist,
                    'metric': self.metric,
                    'random_state': self.random_state
                }
            }
            
            with open(filepath, 'wb') as f:
                pickle.dump(save_data, f)
            
            self.logger.info(f"UMAP reducer saved to {filepath}")
            
        except Exception as e:
            self.logger.error(f"Error saving reducer: {e}")
            raise
    
    def load_reducer(self, filepath: str):
        """Load fitted UMAP reducer and scaler"""
        try:
            with open(filepath, 'rb') as f:
                save_data = pickle.load(f)
            
            self.reducer = save_data['reducer']
            self.scaler = save_data['scaler']
            self.fitted = save_data['fitted']
            
            # Update configuration from saved data
            saved_config = save_data['config']
            self.n_components = saved_config['n_components']
            self.n_neighbors = saved_config['n_neighbors']
            self.min_dist = saved_config['min_dist']
            self.metric = saved_config['metric']
            self.random_state = saved_config['random_state']
            
            self.logger.info(f"UMAP reducer loaded from {filepath}")
            self.logger.info(f"Configuration: {saved_config}")
            
        except Exception as e:
            self.logger.error(f"Error loading reducer: {e}")
            raise
    
    def save_coordinates(self, coordinates: np.ndarray, video_ids: List[str], 
                        filepath: str, quality_metrics: Dict = None):
        """Save 3D coordinates with metadata"""
        try:
            # Save coordinates as numpy array
            np.save(f"{filepath}_coordinates.npy", coordinates)
            
            # Save metadata
            metadata = {
                'video_ids': video_ids,
                'coordinates_shape': coordinates.shape,
                'quality_metrics': quality_metrics or {},
                'umap_config': {
                    'n_components': self.n_components,
                    'n_neighbors': self.n_neighbors,
                    'min_dist': self.min_dist,
                    'metric': self.metric
                }
            }
            
            with open(f"{filepath}_metadata.pkl", 'wb') as f:
                pickle.dump(metadata, f)
            
            self.logger.info(f"Coordinates saved to {filepath}")
            
        except Exception as e:
            self.logger.error(f"Failed to save coordinates: {e}")
            raise
    
    def load_coordinates(self, filepath: str) -> Tuple[np.ndarray, List[str], Dict]:
        """Load 3D coordinates with metadata"""
        try:
            # Load coordinates
            coordinates = np.load(f"{filepath}_coordinates.npy")
            
            # Load metadata
            with open(f"{filepath}_metadata.pkl", 'rb') as f:
                metadata = pickle.load(f)
            
            video_ids = metadata['video_ids']
            
            self.logger.info(f"Loaded {len(coordinates)} coordinates from {filepath}")
            return coordinates, video_ids, metadata
            
        except Exception as e:
            self.logger.error(f"Failed to load coordinates: {e}")
            raise
    
    def get_embedding_neighborhood(self, target_embedding: np.ndarray, 
                                 all_embeddings: np.ndarray, 
                                 k: int = 10) -> np.ndarray:
        """Find k nearest neighbors in embedding space for analysis"""
        if not self.fitted:
            raise ValueError("UMAP must be fitted to analyze neighborhoods")
        
        try:
            # Calculate distances in original embedding space
            distances = pairwise_distances(
                target_embedding.reshape(1, -1), 
                all_embeddings, 
                metric=self.metric
            ).flatten()
            
            # Get indices of k nearest neighbors
            neighbor_indices = np.argsort(distances)[:k]
            
            return neighbor_indices
            
        except Exception as e:
            self.logger.error(f"Error finding neighborhoods: {e}")
            raise

def main():
    """Main function for standalone dimension reduction"""
    import argparse
    from dotenv import load_dotenv
    
    load_dotenv()
    
    parser = argparse.ArgumentParser(description='Reduce video embeddings to 3D')
    parser.add_argument('--embeddings', required=True, 
                       help='Path to embeddings file (without extension)')
    parser.add_argument('--output', default='data/umap_3d', 
                       help='Output path prefix')
    parser.add_argument('--n-neighbors', type=int, default=15, 
                       help='UMAP n_neighbors parameter')
    parser.add_argument('--min-dist', type=float, default=0.1, 
                       help='UMAP min_dist parameter')
    parser.add_argument('--metric', default='cosine', 
                       help='UMAP distance metric')
    
    args = parser.parse_args()
    
    # Load embeddings
    print(f"Loading embeddings from {args.embeddings}")
    embeddings = np.load(f"{args.embeddings}_embeddings.npy")
    
    with open(f"{args.embeddings}_metadata.pkl", 'rb') as f:
        metadata = pickle.load(f)
    video_ids = metadata['video_ids']
    
    print(f"Loaded {len(embeddings)} embeddings with shape {embeddings.shape}")
    
    # Initialize UMAP reducer
    reducer = UMAPDimensionReducer(
        n_neighbors=args.n_neighbors,
        min_dist=args.min_dist,
        metric=args.metric
    )
    
    # Reduce dimensions
    print("Starting UMAP dimension reduction...")
    coordinates_3d, quality_metrics = reducer.fit_transform_embeddings(
        embeddings, video_ids
    )
    
    # Save results
    reducer.save_coordinates(coordinates_3d, video_ids, args.output, quality_metrics)
    reducer.save_reducer(f"{args.output}_model.pkl")
    
    print(f"Dimension reduction completed!")
    print(f"Output shape: {coordinates_3d.shape}")
    print(f"Quality: {quality_metrics.get('reduction_quality', 'unknown')}")
    print(f"Distance correlation: {quality_metrics.get('distance_correlation', 'N/A')}")

if __name__ == "__main__":
    main()