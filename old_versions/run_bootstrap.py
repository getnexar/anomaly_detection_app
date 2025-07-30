#!/usr/bin/env python3
"""
Simplified bootstrap Flask app that runs without complex ML dependencies
"""

from flask import Flask, request, jsonify, send_file, Response, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
import logging
import os
import json
import time

# Initialize Flask app
app = Flask(__name__, static_folder='frontend', static_url_path='')
app.config['SECRET_KEY'] = 'bootstrap-secret-key-for-testing'

# Initialize CORS - Allow external access
CORS(app, origins='*')  # Allow all origins for external accessibility

# Global variables for loaded data
video_data = None
coordinates_3d = None
cluster_info = None

def bootstrap_initialize_app():
    """Bootstrap initialization with minimal dependencies"""
    global video_data, coordinates_3d, cluster_info
    
    try:
        print("📊 Loading bootstrap data...")
        
        # Load video data
        if os.path.exists('data/df_gemini.csv'):
            video_data = pd.read_csv('data/df_gemini.csv')
            print(f"✅ Loaded {len(video_data)} videos")
            
            # Add coordinates from CSV
            if 'x' in video_data.columns:
                coordinates_3d = video_data[['x', 'y', 'z']].values
                print(f"✅ Loaded 3D coordinates for {len(coordinates_3d)} videos")
        
        # Load cluster info
        if os.path.exists('data/cluster_info.json'):
            with open('data/cluster_info.json', 'r') as f:
                cluster_info = json.load(f)
                print(f"✅ Loaded {len(cluster_info)} clusters")
        
        print("🎉 Bootstrap initialization complete!")
        
    except Exception as e:
        print(f"❌ Bootstrap initialization failed: {e}")
        # Set minimal defaults
        video_data = pd.DataFrame()
        coordinates_3d = None
        cluster_info = {}

def require_data(f):
    """Decorator to ensure required data is loaded"""
    def decorated_function(*args, **kwargs):
        if video_data is None:
            return jsonify({'error': 'Video data not loaded'}), 500
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def paginate_results(data, page, per_page):
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
    print("🏥 Health check API called")
    try:
        health_status = {
            'status': 'healthy',
            'timestamp': time.time(),
            'services': {
                'database': 'healthy' if video_data is not None else 'unhealthy',
                'coordinates': 'healthy' if coordinates_3d is not None else 'unhealthy',
                'clusters': 'healthy' if cluster_info is not None else 'unhealthy'
            },
            'metrics': {
                'total_videos': len(video_data) if video_data is not None else 0
            }
        }
        
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
def get_videos():
    """Get paginated list of videos with 3D coordinates"""
    print("📹 Videos API called")
    try:
        # Parse query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 1000)
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
        print(f"Error in get_videos: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/videos/<video_id>', methods=['GET'])
@require_data
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
            'metadata': {
                'main_event': str(video_row.get('main-event', 'unknown')),
                'location': str(video_row.get('location', 'unknown')),
                'zone': str(video_row.get('zone', 'unknown')),
                'light_conditions': str(video_row.get('light-conditions', 'unknown')),
                'weather_conditions': str(video_row.get('weather-conditions', 'unknown')),
                'video_quality': str(video_row.get('video-quality', 'unknown'))
            },
            'coordinates': {
                'x': float(video_row.get('x', 0)),
                'y': float(video_row.get('y', 0)),
                'z': float(video_row.get('z', 0))
            },
            'anomaly_score': float(video_row.get('anomaly_score', 0)),
            'cluster_id': int(video_row.get('cluster_id', -1)),
            'urls': {
                'thumbnail': f"/api/videos/{video_id}/thumbnail",
                'stream': f"/api/videos/{video_id}/stream",
                'download': f"/api/videos/{video_id}/download"
            }
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
        
        return jsonify(video_details), 200
        
    except Exception as e:
        print(f"Error getting video details: {e}")
        return jsonify({'error': str(e)}), 500

# Video streaming endpoints (placeholders for external APIs)
@app.route('/api/videos/<video_id>/stream')
def stream_video(video_id):
    """Get signed video streaming URL from external API"""
    return jsonify({
        'error': 'Video streaming service unavailable',
        'message': 'Video playback requires external streaming service'
    }), 503

@app.route('/api/videos/<video_id>/thumbnail')
def get_video_thumbnail(video_id):
    """Get video thumbnail from external API"""
    return jsonify({
        'error': 'Thumbnail service unavailable',
        'message': 'Thumbnail requires external service',
        'placeholder': True
    }), 503

@app.route('/api/videos/<video_id>/download')
def download_video(video_id):
    """Get video download URL from external API"""
    return jsonify({
        'error': 'Download service unavailable',
        'message': 'Video download requires external service'
    }), 503

# Clusters endpoint
@app.route('/api/clusters')
@require_data
def get_clusters():
    """Get cluster information"""
    try:
        if not cluster_info:
            return jsonify({'clusters': [], 'message': 'No cluster information available'}), 200
        
        clusters = []
        for cluster_id, cluster_data in cluster_info.items():
            cluster_item = {
                'cluster_id': int(cluster_id) if cluster_id != '-1' else -1,
                'label': cluster_data.get('label', f'Cluster {cluster_id}'),
                'size': cluster_data.get('size', 0),
                'keywords': cluster_data.get('keywords', [])
            }
            
            # Add cluster statistics
            cluster_videos = video_data[video_data['cluster_id'] == int(cluster_id)]
            if not cluster_videos.empty:
                cluster_item['stats'] = {
                    'avg_anomaly_score': float(cluster_videos['anomaly_score'].mean()),
                    'main_events': cluster_videos['main-event'].value_counts().to_dict()
                }
                
                # Add centroid coordinates
                if coordinates_3d is not None:
                    cluster_indices = cluster_videos.index
                    valid_indices = [i for i in cluster_indices if i < len(coordinates_3d)]
                    if valid_indices:
                        cluster_coords = coordinates_3d[valid_indices]
                        centroid = np.mean(cluster_coords, axis=0)
                        cluster_item['centroid'] = {
                            'x': float(centroid[0]),
                            'y': float(centroid[1]),
                            'z': float(centroid[2])
                        }
            
            clusters.append(cluster_item)
        
        return jsonify({
            'clusters': clusters,
            'total_clusters': len(clusters)
        }), 200
        
    except Exception as e:
        print(f"Clusters error: {e}")
        return jsonify({'error': 'Failed to get clusters', 'details': str(e)}), 500

# Anomalies endpoint
@app.route('/api/anomalies')
@require_data
def get_anomalies():
    """Get anomalous videos"""
    try:
        threshold = float(request.args.get('threshold', 0.5))
        limit = min(int(request.args.get('limit', 100)), 1000)
        
        # Filter videos by anomaly score
        anomalous_videos = video_data[video_data['anomaly_score'] > threshold]
        anomalous_videos = anomalous_videos.nlargest(limit, 'anomaly_score')
        
        results = []
        for _, row in anomalous_videos.iterrows():
            video_item = {
                'video_id': str(row['video_id']),
                'title': str(row.get('video-title', '')),
                'main_event': str(row.get('main-event', 'unknown')),
                'anomaly_score': float(row.get('anomaly_score', 0)),
                'coordinates': {
                    'x': float(row.get('x', 0)),
                    'y': float(row.get('y', 0)),
                    'z': float(row.get('z', 0))
                }
            }
            results.append(video_item)
        
        return jsonify({
            'videos': results,
            'anomaly_stats': {
                'threshold': threshold,
                'total_anomalies': len(results),
                'avg_score': float(anomalous_videos['anomaly_score'].mean()) if not anomalous_videos.empty else 0
            }
        }), 200
        
    except Exception as e:
        print(f"Anomalies error: {e}")
        return jsonify({'error': 'Failed to get anomalies', 'details': str(e)}), 500

# Metadata filters endpoint
@app.route('/api/filters/metadata')
@require_data
def get_metadata_filters():
    """Get available filter options"""
    try:
        filter_fields = [
            'main-event', 'location', 'zone', 'weather-conditions', 
            'light-conditions', 'video-quality', 'type-of-vehicle-recording'
        ]
        
        available_filters = {}
        for field in filter_fields:
            if field in video_data.columns:
                value_counts = video_data[field].value_counts()
                available_filters[field] = [
                    {
                        'value': str(value),
                        'label': str(value).replace('-', ' ').title(),
                        'count': int(count)
                    }
                    for value, count in value_counts.items()
                    if pd.notna(value) and str(value).lower() not in ['nan', 'none', '']
                ]
        
        return jsonify(available_filters), 200
        
    except Exception as e:
        print(f"Metadata filters error: {e}")
        return jsonify({'error': 'Failed to get metadata filters', 'details': str(e)}), 500

# Serve static files (must be after API routes)
@app.route('/')
def serve_index():
    """Serve the main application"""
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    try:
        return send_from_directory('frontend', path)
    except:
        # If file not found, serve index.html for SPA routing
        return send_from_directory('frontend', 'index.html')

if __name__ == '__main__':
    # Initialize the application
    bootstrap_initialize_app()
    
    # Run the Flask app
    print("🚀 Starting Advanced 3D Video Analysis System...")
    print("🌐 Navigate to: http://localhost:8200")
    print("🌍 External access: http://<your-ip>:8200")
    app.run(
        host='0.0.0.0',
        port=8200,
        debug=False  # Disable debug for external access
    )