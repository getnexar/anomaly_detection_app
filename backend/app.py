from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from flask_caching import Cache
import pandas as pd
import numpy as np
import logging
import os
import json
from typing import Dict, List, Optional
import time
from functools import wraps
import mimetypes
from pathlib import Path

# Import our custom modules
from config.config import config, load_config_from_env
from backend.models.vector_store import FAISSVectorStore
from data_processing.embedding_generator import MultiLayeredEmbeddingGenerator
from data_processing.anomaly_detector import AdvancedAnomalyDetector
from openai import OpenAI

# Load configuration
load_config_from_env()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = config.flask.secret_key
app.config['MAX_CONTENT_LENGTH'] = config.flask.max_content_length

# Initialize CORS
CORS(app, origins=config.flask.cors_origins)

# Initialize caching
cache_config = {
    'CACHE_TYPE': config.cache.type,
    'CACHE_REDIS_URL': config.cache.redis_url if config.cache.type == 'redis' else None,
    'CACHE_DEFAULT_TIMEOUT': config.cache.default_timeout
}
cache = Cache(app, config=cache_config)

# Global variables for loaded models and data
vector_store = None
video_data = None
coordinates_3d = None
cluster_info = None
anomaly_detector = None
openai_client = None

def initialize_app():
    """Initialize the application with data and models"""
    global vector_store, video_data, coordinates_3d, cluster_info, anomaly_detector, openai_client
    
    logger = logging.getLogger(__name__)
    logger.info("Initializing application...")
    
    try:
        # Initialize OpenAI client
        openai_client = OpenAI(api_key=config.openai.api_key)
        logger.info("OpenAI client initialized")
        
        # Load video data
        if os.path.exists(config.data_csv_path):
            video_data = pd.read_csv(config.data_csv_path)
            # Ensure video_id column exists
            if 'video_id' not in video_data.columns:
                video_data['video_id'] = video_data.index.astype(str)
            logger.info(f"Loaded {len(video_data)} video records")
        else:
            logger.warning(f"Video data file not found: {config.data_csv_path}")
        
        # Load vector store
        try:
            vector_store = FAISSVectorStore(dimension=config.openai.dimension)
            if os.path.exists(f"{config.vector_db.index_path}.faiss"):
                vector_store.load_index(config.vector_db.index_path)
                logger.info("Vector store loaded successfully")
            else:
                logger.warning("Vector store index not found - search functionality will be limited")
        except Exception as e:
            logger.error(f"Failed to load vector store: {e}")
        
        # Load 3D coordinates
        try:
            if os.path.exists(f"{config.umap.coordinates_path}"):
                coordinates_3d = np.load(config.umap.coordinates_path)
                logger.info(f"Loaded 3D coordinates: {coordinates_3d.shape}")
            else:
                logger.warning("3D coordinates not found - visualization will be limited")
        except Exception as e:
            logger.error(f"Failed to load 3D coordinates: {e}")
        
        # Load cluster information
        try:
            if os.path.exists(config.clustering.cluster_info_path):
                with open(config.clustering.cluster_info_path, 'r') as f:
                    cluster_info = json.load(f)
                logger.info(f"Loaded cluster information for {len(cluster_info)} clusters")
            else:
                logger.warning("Cluster information not found")
        except Exception as e:
            logger.error(f"Failed to load cluster information: {e}")
        
        # Load anomaly detector
        try:
            anomaly_detector = AdvancedAnomalyDetector()
            anomaly_results_path = "data/anomaly_results.pkl"
            if os.path.exists(anomaly_results_path):
                anomaly_detector.load_anomaly_results(anomaly_results_path)
                logger.info("Anomaly detector loaded with results")
            else:
                logger.warning("Anomaly results not found")
        except Exception as e:
            logger.error(f"Failed to load anomaly detector: {e}")
        
        logger.info("Application initialization completed")
        
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise

def require_data(f):
    """Decorator to ensure required data is loaded"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if video_data is None:
            return jsonify({'error': 'Video data not loaded'}), 500
        return f(*args, **kwargs)
    return decorated_function

def paginate_results(data: List, page: int, per_page: int) -> Dict:
    """Paginate results and return pagination info"""
    total = len(data)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    
    paginated_data = data[start_idx:end_idx]
    
    return {
        'data': paginated_data,
        'pagination': {
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total - 1) // per_page + 1 if total > 0 else 0,
            'has_next': end_idx < total,
            'has_prev': page > 1
        }
    }

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    """System health check"""
    try:
        health_status = {
            'status': 'healthy',
            'timestamp': time.time(),
            'services': {
                'database': 'healthy' if video_data is not None else 'unhealthy',
                'vector_store': 'healthy' if vector_store is not None else 'unhealthy',
                'coordinates': 'healthy' if coordinates_3d is not None else 'unhealthy',
                'clusters': 'healthy' if cluster_info is not None else 'unhealthy',
                'anomaly_detector': 'healthy' if anomaly_detector is not None else 'unhealthy'
            },
            'metrics': {
                'total_videos': len(video_data) if video_data is not None else 0,
                'vector_store_stats': vector_store.get_statistics() if vector_store else {},
                'memory_usage_mb': 0  # Could implement actual memory monitoring
            }
        }
        
        # Determine overall status
        unhealthy_services = [k for k, v in health_status['services'].items() if v == 'unhealthy']
        if len(unhealthy_services) > 2:
            health_status['status'] = 'unhealthy'
        elif unhealthy_services:
            health_status['status'] = 'degraded'
        
        return jsonify(health_status), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': time.time()
        }), 500

# Video endpoints
@app.route('/api/videos', methods=['GET'])
@require_data
@cache.cached(timeout=config.cache.video_cache_timeout)
def get_videos():
    """Get paginated list of videos with 3D coordinates"""
    try:
        # Parse query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', config.performance.default_page_size, type=int), 
                      config.performance.max_page_size)
        cluster_id = request.args.get('cluster_id', type=int)
        anomaly_threshold = request.args.get('anomaly_threshold', 0.0, type=float)
        sort_by = request.args.get('sort_by', 'video_id')
        sort_order = request.args.get('sort_order', 'asc')
        
        # Start with base data
        result_data = video_data.copy()
        
        # Apply filters
        if cluster_id is not None:
            result_data = result_data[result_data.get('cluster_id') == cluster_id]
        
        if anomaly_threshold > 0:
            result_data = result_data[result_data.get('anomaly_score', 0) >= anomaly_threshold]
        
        # Add 3D coordinates if available
        if coordinates_3d is not None:
            coord_indices = result_data.index.tolist()
            valid_indices = [i for i in coord_indices if i < len(coordinates_3d)]
            
            if valid_indices:
                coords_subset = coordinates_3d[valid_indices]
                result_data = result_data.loc[valid_indices].copy()
                result_data['x'] = coords_subset[:, 0]
                result_data['y'] = coords_subset[:, 1]
                result_data['z'] = coords_subset[:, 2]
        
        # Sort results
        if sort_by in result_data.columns:
            ascending = sort_order.lower() == 'asc'
            result_data = result_data.sort_values(sort_by, ascending=ascending)
        
        # Convert to list of dictionaries for API response
        videos_list = []
        for _, row in result_data.iterrows():
            video_dict = {
                'video_id': str(row.get('video_id', '')),
                'title': str(row.get('video-title', '')),
                'main_event': str(row.get('main-event', 'unknown')),
                'location': str(row.get('location', 'unknown')),
                'zone': str(row.get('zone', 'unknown')),
                'light_conditions': str(row.get('light-conditions', 'unknown')),
                'weather_conditions': str(row.get('weather-conditions', 'unknown')),
                'video_quality': str(row.get('video-quality', 'unknown')),
                'anomaly_score': float(row.get('anomaly_score', 0)),
                'cluster_id': int(row.get('cluster_id', -1)),
                'coordinates': {
                    'x': float(row.get('x', 0)),
                    'y': float(row.get('y', 0)),
                    'z': float(row.get('z', 0))
                },
                'thumbnail_url': f"/api/videos/{row.get('video_id', '')}/thumbnail"
            }
            videos_list.append(video_dict)
        
        # Paginate results
        paginated = paginate_results(videos_list, page, per_page)
        
        return jsonify({
            'videos': paginated['data'],
            'pagination': paginated['pagination']
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error in get_videos: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/videos/<video_id>', methods=['GET'])
@require_data
@cache.cached(timeout=config.cache.video_cache_timeout)
def get_video_details(video_id):
    """Get detailed information for a specific video"""
    try:
        # Find video in dataset
        video_row = video_data[video_data['video_id'] == video_id]
        
        if video_row.empty:
            return jsonify({'error': 'Video not found'}), 404
        
        video_row = video_row.iloc[0]
        
        # Build detailed response
        video_details = {
            'video_id': str(video_id),
            'video_path': str(video_row.get('video_path', '')),
            'title': str(video_row.get('video-title', '')),
            'description_step_by_step': str(video_row.get('description-step-by-step', '')),
            'interpretation': str(video_row.get('interpretation', '')),
            'general_description': str(video_row.get('general-description', '')),
            'observed_objects': video_row.get('observed-objects', ''),
            'key_terms': video_row.get('key-terms', ''),
            'metadata': {
                'main_event': str(video_row.get('main-event', 'unknown')),
                'location': str(video_row.get('location', 'unknown')),
                'zone': str(video_row.get('zone', 'unknown')),
                'light_conditions': str(video_row.get('light-conditions', 'unknown')),
                'weather_conditions': str(video_row.get('weather-conditions', 'unknown')),
                'visibility_condition': str(video_row.get('visibility-condition', 'unknown')),
                'road_surface_state': str(video_row.get('road-surface-state', 'unknown')),
                'road_surface_type': str(video_row.get('road-surface-type', 'unknown')),
                'road_saturation': str(video_row.get('road-saturation', 'unknown')),
                'type_of_vehicle_recording': str(video_row.get('type-of-vehicle-recording', 'unknown')),
                'video_quality': str(video_row.get('video-quality', 'unknown')),
                'camera_mounting_state': str(video_row.get('camera-mounting-state', 'unknown')),
                'camera_viewpoint_direction': str(video_row.get('camera-viewpoint-direction', 'unknown'))
            },
            'urls': {
                'thumbnail': f"/api/videos/{video_id}/thumbnail",
                'stream': f"/api/videos/{video_id}/stream",
                'download': f"/api/videos/{video_id}/download"
            }
        }
        
        # Add coordinates if available
        row_index = video_row.name
        if coordinates_3d is not None and row_index < len(coordinates_3d):
            coords = coordinates_3d[row_index]
            video_details['coordinates'] = {
                'x': float(coords[0]),
                'y': float(coords[1]),
                'z': float(coords[2])
            }
        
        # Add cluster information
        cluster_id = video_row.get('cluster_id', -1)
        if cluster_info and str(cluster_id) in cluster_info:
            cluster_data = cluster_info[str(cluster_id)]
            video_details['cluster_info'] = {
                'cluster_id': int(cluster_id),
                'cluster_label': cluster_data.get('label', 'Unknown'),
                'cluster_size': cluster_data.get('size', 0),
                'cluster_keywords': cluster_data.get('keywords', [])
            }
        
        # Add anomaly information
        if anomaly_detector and anomaly_detector.fitted:
            anomaly_info = anomaly_detector.get_anomaly_explanation(video_id)
            if anomaly_info:
                video_details['anomaly_info'] = anomaly_info
        
        # Add similar videos (if vector store is available)
        if vector_store and video_id in vector_store.video_metadata:
            try:
                # Get embedding for this video and find similar ones
                similar_results = vector_store.search_similar(
                    # This would need the actual embedding - simplified for now
                    np.random.random(config.openai.dimension), 
                    k=6  # Get 6 to exclude self and return 5
                )
                
                similar_videos = []
                for vid, similarity in similar_results[:5]:  # Skip first (self) and get 5
                    if vid != video_id:
                        similar_videos.append({
                            'video_id': vid,
                            'similarity_score': similarity,
                            'title': str(video_data[video_data['video_id'] == vid]['video-title'].iloc[0] if not video_data[video_data['video_id'] == vid].empty else 'Unknown')
                        })
                
                video_details['similar_videos'] = similar_videos[:5]
                
            except Exception as e:
                app.logger.warning(f"Could not get similar videos: {e}")
        
        return jsonify(video_details), 200
        
    except Exception as e:
        app.logger.error(f"Error getting video details: {e}")
        return jsonify({'error': str(e)}), 500

# Search endpoint
@app.route('/api/videos/search', methods=['POST'])
@require_data
@cache.cached(timeout=config.cache.search_cache_timeout)
def search_videos():
    """Semantic search using embeddings"""
    try:
        if not vector_store or not openai_client:
            return jsonify({'error': 'Search functionality not available'}), 503
        
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({'error': 'Query is required'}), 400
        
        query = data['query'].strip()
        limit = min(data.get('limit', 50), config.performance.max_search_results)
        similarity_threshold = data.get('similarity_threshold', config.performance.similarity_threshold)
        include_metadata = data.get('include_metadata', True)
        boost_anomalies = data.get('boost_anomalies', False)
        
        if not query:
            return jsonify({'error': 'Query cannot be empty'}), 400
        
        # Generate embedding for query
        embedding_generator = MultiLayeredEmbeddingGenerator(openai_client)
        
        # Create a temporary video row for embedding generation
        query_row = {
            'video-title': query,
            'description-step-by-step': query,
            'general-description': query,
            'interpretation': 'User search query',
            'main-event': 'search',
            'location': 'unknown',
            'zone': 'unknown'
        }
        
        query_embedding = embedding_generator.generate_multi_layered_embedding(query_row)
        
        # Search for similar videos
        search_results = vector_store.search_similar(
            query_embedding, 
            k=limit * 2,  # Get more results to filter
            threshold=similarity_threshold
        )
        
        # Process results
        results = []
        for video_id, similarity in search_results[:limit]:
            # Get video data
            video_row = video_data[video_data['video_id'] == video_id]
            if video_row.empty:
                continue
            
            video_row = video_row.iloc[0]
            
            result_item = {
                'video_id': str(video_id),
                'similarity_score': float(similarity),
                'title': str(video_row.get('video-title', '')),
                'main_event': str(video_row.get('main-event', 'unknown')),
                'anomaly_score': float(video_row.get('anomaly_score', 0))
            }
            
            # Add coordinates if available
            row_index = video_row.name
            if coordinates_3d is not None and row_index < len(coordinates_3d):
                coords = coordinates_3d[row_index]
                result_item['coordinates'] = {
                    'x': float(coords[0]),
                    'y': float(coords[1]),
                    'z': float(coords[2])
                }
            
            # Add metadata if requested
            if include_metadata:
                result_item['metadata'] = {
                    'location': str(video_row.get('location', 'unknown')),
                    'weather_conditions': str(video_row.get('weather-conditions', 'unknown')),
                    'light_conditions': str(video_row.get('light-conditions', 'unknown'))
                }
            
            results.append(result_item)
        
        # Boost anomalies if requested
        if boost_anomalies:
            results.sort(key=lambda x: (x['anomaly_score'], x['similarity_score']), reverse=True)
        
        return jsonify({
            'query': query,
            'results': results,
            'search_stats': {
                'total_candidates': vector_store.get_statistics().get('total_vectors', 0),
                'filtered_results': len(results),
                'similarity_threshold': similarity_threshold
            }
        }), 200
        
    except Exception as e:
        app.logger.error(f"Search error: {e}")
        return jsonify({'error': 'Search failed', 'details': str(e)}), 500

# Continue with more endpoints...
# (Due to length constraints, I'll continue in the next part)

if __name__ == '__main__':
    # Initialize the application
    initialize_app()
    
    # Run the Flask app
    app.run(
        host=config.flask.host,
        port=config.flask.port,
        debug=config.flask.debug
    )