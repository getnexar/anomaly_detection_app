import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import json
import logging

@dataclass
class OpenAIConfig:
    """OpenAI API configuration"""
    api_key: str = field(default_factory=lambda: os.getenv('OPENAI_API_KEY', ''))
    model: str = 'text-embedding-3-large'
    dimension: int = 3072
    batch_size: int = 100
    max_retries: int = 3
    timeout: int = 30
    
    def __post_init__(self):
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")

@dataclass
class VectorDatabaseConfig:
    """FAISS vector database configuration"""
    index_type: str = 'IndexFlatIP'  # Inner Product for cosine similarity
    index_path: str = 'data/faiss_index'
    metadata_path: str = 'data/faiss_metadata.pkl'
    batch_size: int = 1000
    cache_size: int = 10000
    save_interval: int = 1000  # Save every N additions
    
    # Advanced FAISS settings
    nlist: int = 1024  # For IVF indices
    nprobe: int = 64   # For IVF search
    m: int = 32        # For PQ compression
    nbits: int = 8     # For PQ quantization

@dataclass 
class UMAPConfig:
    """UMAP dimensionality reduction configuration"""
    n_components: int = 3
    n_neighbors: int = 15
    min_dist: float = 0.1
    metric: str = 'cosine'
    random_state: int = 42
    
    # Advanced UMAP parameters
    spread: float = 1.0
    local_connectivity: float = 1.0
    repulsion_strength: float = 1.0
    negative_sample_rate: int = 5
    transform_queue_size: float = 4.0
    
    # Performance settings
    low_memory: bool = True
    n_jobs: int = 4
    verbose: bool = True
    
    # Output paths
    model_path: str = 'data/umap_model.pkl'
    coordinates_path: str = 'data/umap_coordinates.npy'

@dataclass
class ClusteringConfig:
    """HDBSCAN clustering configuration"""
    min_cluster_size: int = 50
    min_samples: int = 10
    cluster_selection_epsilon: float = 0.0
    metric: str = 'euclidean'
    cluster_selection_method: str = 'eom'  # Excess of Mass
    algorithm: str = 'best'
    leaf_size: int = 40
    
    # Performance settings
    n_jobs: int = 4
    
    # Output paths
    model_path: str = 'data/hdbscan_model.pkl'
    cluster_info_path: str = 'data/cluster_info.json'
    
    # Labeling configuration
    max_keywords_per_cluster: int = 10
    min_keyword_frequency: int = 2
    tfidf_max_features: int = 100

@dataclass
class AnomalyDetectionConfig:
    """Anomaly detection configuration"""
    # Isolation Forest settings
    contamination: float = 0.1
    n_estimators: int = 200
    max_samples: str = 'auto'
    max_features: float = 1.0
    bootstrap: bool = False
    random_state: int = 42
    n_jobs: int = 4
    
    # Text-based anomaly keywords with weights
    anomaly_keywords: Dict[str, float] = field(default_factory=lambda: {
        # Critical incidents
        'accident': 1.0, 'collision': 1.0, 'crash': 1.0, 'emergency': 0.9,
        'severe': 0.8, 'critical': 0.8, 'dangerous': 0.8, 'fatal': 1.0,
        
        # Traffic violations
        'violation': 0.6, 'illegal': 0.7, 'wrong': 0.5, 'speeding': 0.6,
        'reckless': 0.7, 'aggressive': 0.6,
        
        # Unusual behaviors
        'unusual': 0.4, 'strange': 0.4, 'unexpected': 0.4, 'odd': 0.3,
        'bizarre': 0.5, 'erratic': 0.6,
        
        # Weather/visibility related
        'visibility': 0.3, 'fog': 0.3, 'rain': 0.2, 'snow': 0.3,
        'storm': 0.5, 'flooding': 0.7,
        
        # Object/obstruction related
        'obstruction': 0.5, 'debris': 0.4, 'obstacle': 0.4,
        'construction': 0.2, 'roadwork': 0.2
    })
    
    # Normal indicators (reduce anomaly score)
    normal_indicators: List[str] = field(default_factory=lambda: [
        'no anomalies observed', 'normal driving', 'routine', 'typical',
        'standard', 'usual', 'regular', 'common', 'expected'
    ])
    
    # Score combination weights
    embedding_weight: float = 0.4
    text_weight: float = 0.35
    metadata_weight: float = 0.15
    statistical_weight: float = 0.1

@dataclass
class FlaskConfig:
    """Flask application configuration"""
    host: str = '0.0.0.0'
    port: int = 5000
    debug: bool = False
    secret_key: str = field(default_factory=lambda: os.getenv('FLASK_SECRET_KEY', 'dev-secret-key'))
    
    # CORS settings
    cors_origins: str = '*'
    
    # Rate limiting
    rate_limit: str = '1000/hour'
    
    # File upload settings
    max_content_length: int = 16 * 1024 * 1024  # 16MB

@dataclass
class CacheConfig:
    """Caching configuration"""
    type: str = 'redis'
    redis_url: str = field(default_factory=lambda: os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
    default_timeout: int = 300  # 5 minutes
    
    # Specific cache timeouts
    video_cache_timeout: int = 3600      # 1 hour
    search_cache_timeout: int = 300      # 5 minutes
    filter_cache_timeout: int = 3600     # 1 hour
    cluster_cache_timeout: int = 1800    # 30 minutes

@dataclass
class PerformanceConfig:
    """Performance optimization settings"""
    # Pagination
    default_page_size: int = 1000
    max_page_size: int = 5000
    
    # Batch processing
    embedding_batch_size: int = 100
    processing_batch_size: int = 1000
    
    # Memory limits
    max_memory_gb: int = 8
    worker_threads: int = 4
    
    # Search limits
    max_search_results: int = 100
    similarity_threshold: float = 0.5

@dataclass
class SystemConfig:
    """Main system configuration"""
    openai: OpenAIConfig = field(default_factory=OpenAIConfig)
    vector_db: VectorDatabaseConfig = field(default_factory=VectorDatabaseConfig)
    umap: UMAPConfig = field(default_factory=UMAPConfig)
    clustering: ClusteringConfig = field(default_factory=ClusteringConfig)
    anomaly: AnomalyDetectionConfig = field(default_factory=AnomalyDetectionConfig)
    flask: FlaskConfig = field(default_factory=FlaskConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    
    # Data paths
    data_csv_path: str = 'data/df_gemini.csv'
    video_base_path: str = 'data/videos/'
    
    # Logging
    log_level: str = field(default_factory=lambda: os.getenv('LOG_LEVEL', 'INFO'))
    log_file: str = 'logs/app.log'
    
    def __post_init__(self):
        # Create directories if they don't exist
        os.makedirs('data', exist_ok=True)
        os.makedirs('logs', exist_ok=True)
        
        # Setup logging
        logging.basicConfig(
            level=getattr(logging, self.log_level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler()
            ]
        )

# Global configuration instance
config = SystemConfig()

def load_config_from_env():
    """Load configuration overrides from environment variables"""
    # OpenAI overrides
    if os.getenv('OPENAI_MODEL'):
        config.openai.model = os.getenv('OPENAI_MODEL')
    
    # UMAP overrides
    if os.getenv('UMAP_N_NEIGHBORS'):
        config.umap.n_neighbors = int(os.getenv('UMAP_N_NEIGHBORS'))
    if os.getenv('UMAP_MIN_DIST'):
        config.umap.min_dist = float(os.getenv('UMAP_MIN_DIST'))
    
    # Clustering overrides
    if os.getenv('HDBSCAN_MIN_CLUSTER_SIZE'):
        config.clustering.min_cluster_size = int(os.getenv('HDBSCAN_MIN_CLUSTER_SIZE'))
    
    # Flask overrides
    if os.getenv('FLASK_HOST'):
        config.flask.host = os.getenv('FLASK_HOST')
    if os.getenv('FLASK_PORT'):
        config.flask.port = int(os.getenv('FLASK_PORT'))
    
    return config

def save_config_to_file(filepath: str):
    """Save current configuration to JSON file"""
    import dataclasses
    import json
    
    def dataclass_to_dict(obj):
        if dataclasses.is_dataclass(obj):
            return {k: dataclass_to_dict(v) for k, v in dataclasses.asdict(obj).items()}
        return obj
    
    config_dict = dataclass_to_dict(config)
    
    with open(filepath, 'w') as f:
        json.dump(config_dict, f, indent=2)

def load_config_from_file(filepath: str):
    """Load configuration from JSON file"""
    with open(filepath, 'r') as f:
        config_dict = json.load(f)
    
    # Update global config with loaded values
    # This would require more complex implementation to properly update nested dataclasses
    print(f"Configuration loaded from {filepath}")
    return config_dict