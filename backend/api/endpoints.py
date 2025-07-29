# Additional Flask API endpoints
from flask import Flask, request, jsonify, send_file, Response
import pandas as pd
import numpy as np
import json
import os
from pathlib import Path
import mimetypes
from functools import wraps
import cv2
from PIL import Image
import io

def add_remaining_endpoints(app, cache, video_data, coordinates_3d, cluster_info, anomaly_detector, vector_store):
    """Add remaining API endpoints to the Flask app"""
    
    # Filter endpoints
    @app.route('/api/filters/metadata', methods=['GET'])
    @cache.cached(timeout=3600)  # Cache for 1 hour
    def get_metadata_filters():
        """Get available filter options with counts"""
        try:
            if video_data is None:
                return jsonify({'error': 'Video data not loaded'}), 500
            
            filters = {}
            
            # Define categorical fields to analyze
            categorical_fields = [
                'main-event', 'location', 'zone', 'light-conditions',
                'weather-conditions', 'road-conditions', 'type-of-vehicle-recording',
                'video-quality'
            ]
            
            for field in categorical_fields:
                if field in video_data.columns:
                    value_counts = video_data[field].value_counts()
                    filters[field] = {str(k): int(v) for k, v in value_counts.items()}
            
            # Add anomaly score distribution
            if 'anomaly_score' in video_data.columns:
                anomaly_scores = video_data['anomaly_score'].fillna(0)
                filters['anomaly_score_distribution'] = {
                    '0.0-0.2': int((anomaly_scores < 0.2).sum()),
                    '0.2-0.4': int(((anomaly_scores >= 0.2) & (anomaly_scores < 0.4)).sum()),
                    '0.4-0.6': int(((anomaly_scores >= 0.4) & (anomaly_scores < 0.6)).sum()),
                    '0.6-0.8': int(((anomaly_scores >= 0.6) & (anomaly_scores < 0.8)).sum()),
                    '0.8-1.0': int((anomaly_scores >= 0.8).sum())
                }
            
            return jsonify(filters), 200
            
        except Exception as e:
            app.logger.error(f"Error getting metadata filters: {e}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/videos/filter', methods=['POST'])
    @cache.cached(timeout=300)  # Cache for 5 minutes
    def filter_videos():
        """Filter videos by metadata with complex conditions"""
        try:
            if video_data is None:
                return jsonify({'error': 'Video data not loaded'}), 500
            
            data = request.get_json()
            if not data or 'filters' not in data:
                return jsonify({'error': 'Filters are required'}), 400
            
            filters = data['filters']
            sort_by = data.get('sort_by', 'video_id')
            sort_order = data.get('sort_order', 'asc')
            page = data.get('page', 1)
            per_page = min(data.get('per_page', 1000), 5000)
            
            # Start with all data
            filtered_data = video_data.copy()
            
            # Apply each filter
            for field, filter_config in filters.items():
                if field in filtered_data.columns:
                    if isinstance(filter_config, dict):
                        # Handle include/exclude lists
                        if 'include' in filter_config and filter_config['include']:
                            filtered_data = filtered_data[filtered_data[field].isin(filter_config['include'])]
                        if 'exclude' in filter_config and filter_config['exclude']:
                            filtered_data = filtered_data[~filtered_data[field].isin(filter_config['exclude'])]
                    elif isinstance(filter_config, list):
                        # Simple include list
                        filtered_data = filtered_data[filtered_data[field].isin(filter_config)]
            
            # Handle anomaly score range
            if 'anomaly_score' in filters:
                anomaly_config = filters['anomaly_score']
                if isinstance(anomaly_config, dict):
                    if 'min' in anomaly_config:
                        filtered_data = filtered_data[filtered_data.get('anomaly_score', 0) >= anomaly_config['min']]
                    if 'max' in anomaly_config:
                        filtered_data = filtered_data[filtered_data.get('anomaly_score', 0) <= anomaly_config['max']]
            
            # Add 3D coordinates if available
            if coordinates_3d is not None:
                valid_indices = [i for i in filtered_data.index if i < len(coordinates_3d)]
                if valid_indices:
                    coords_subset = coordinates_3d[valid_indices]
                    filtered_data = filtered_data.loc[valid_indices].copy()
                    filtered_data['x'] = coords_subset[:, 0]
                    filtered_data['y'] = coords_subset[:, 1]
                    filtered_data['z'] = coords_subset[:, 2]
            
            # Sort results
            if sort_by in filtered_data.columns:
                ascending = sort_order.lower() == 'asc'
                filtered_data = filtered_data.sort_values(sort_by, ascending=ascending)
            
            # Convert to API format
            videos_list = []
            for _, row in filtered_data.iterrows():
                video_dict = {
                    'video_id': str(row.get('video_id', '')),
                    'title': str(row.get('video-title', '')),
                    'main_event': str(row.get('main-event', 'unknown')),
                    'location': str(row.get('location', 'unknown')),
                    'anomaly_score': float(row.get('anomaly_score', 0)),
                    'cluster_id': int(row.get('cluster_id', -1)),
                    'coordinates': {
                        'x': float(row.get('x', 0)),
                        'y': float(row.get('y', 0)),
                        'z': float(row.get('z', 0))
                    }
                }
                videos_list.append(video_dict)
            
            # Paginate
            total = len(videos_list)
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_videos = videos_list[start_idx:end_idx]
            
            return jsonify({
                'videos': paginated_videos,
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total - 1) // per_page + 1 if total > 0 else 0,
                'filters_applied': filters
            }), 200
            
        except Exception as e:
            app.logger.error(f"Error filtering videos: {e}")
            return jsonify({'error': str(e)}), 500
    
    # Cluster endpoints
    @app.route('/api/clusters', methods=['GET'])
    @cache.cached(timeout=1800)  # Cache for 30 minutes
    def get_clusters():
        """Get comprehensive cluster information"""
        try:
            if not cluster_info:
                return jsonify({'error': 'Cluster information not available'}), 503
            
            include_stats = request.args.get('include_stats', 'false').lower() == 'true'
            
            clusters_list = []
            total_videos = 0
            
            for cluster_id, info in cluster_info.items():
                cluster_data = {
                    'cluster_id': int(cluster_id),
                    'label': info.get('label', 'Unknown'),
                    'size': info.get('size', 0),
                    'centroid': info.get('centroid', [0, 0, 0]),
                    'bounding_box': info.get('bounding_box', {'min': [0, 0, 0], 'max': [0, 0, 0]}),
                    'top_keywords': info.get('keywords', [])[:5],  # Top 5 keywords
                    'sample_videos': info.get('sample_videos', [])[:3]  # Top 3 samples
                }
                
                if include_stats:
                    cluster_data['statistics'] = info.get('statistics', {})
                    cluster_data['metadata_patterns'] = info.get('metadata_patterns', {})
                
                clusters_list.append(cluster_data)
                total_videos += info.get('size', 0)
            
            # Sort by size (largest first)
            clusters_list.sort(key=lambda x: x['size'], reverse=True)
            
            response_data = {
                'clusters': clusters_list,
                'cluster_stats': {
                    'total_clusters': len(clusters_list),
                    'total_clustered_videos': total_videos,
                    'avg_cluster_size': total_videos / len(clusters_list) if clusters_list else 0,
                    'largest_cluster_size': max([c['size'] for c in clusters_list]) if clusters_list else 0,
                    'smallest_cluster_size': min([c['size'] for c in clusters_list]) if clusters_list else 0
                }
            }
            
            return jsonify(response_data), 200
            
        except Exception as e:
            app.logger.error(f"Error getting clusters: {e}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/clusters/<int:cluster_id>', methods=['GET'])
    @cache.cached(timeout=1800)
    def get_cluster_details(cluster_id):
        """Get detailed information about specific cluster"""
        try:
            if not cluster_info or str(cluster_id) not in cluster_info:
                return jsonify({'error': 'Cluster not found'}), 404
            
            cluster_data = cluster_info[str(cluster_id)]
            
            # Get videos in this cluster
            cluster_videos = []
            if video_data is not None:
                cluster_mask = video_data.get('cluster_id') == cluster_id
                cluster_video_data = video_data[cluster_mask]
                
                for _, row in cluster_video_data.head(20).iterrows():  # Limit to 20 videos
                    video_info = {
                        'video_id': str(row.get('video_id', '')),
                        'title': str(row.get('video-title', '')),
                        'anomaly_score': float(row.get('anomaly_score', 0)),
                        'main_event': str(row.get('main-event', 'unknown'))
                    }
                    cluster_videos.append(video_info)
            
            detailed_info = {
                'cluster_id': cluster_id,
                'label': cluster_data.get('label', 'Unknown'),
                'size': cluster_data.get('size', 0),
                'centroid': cluster_data.get('centroid', [0, 0, 0]),
                'bounding_box': cluster_data.get('bounding_box', {}),
                'keywords': cluster_data.get('keywords', []),
                'themes': cluster_data.get('themes', []),
                'statistics': cluster_data.get('statistics', {}),
                'metadata_patterns': cluster_data.get('metadata_patterns', {}),
                'sample_videos': cluster_data.get('sample_videos', []),
                'member_videos': cluster_videos
            }
            
            return jsonify(detailed_info), 200
            
        except Exception as e:
            app.logger.error(f"Error getting cluster details: {e}")
            return jsonify({'error': str(e)}), 500
    
    # Anomaly endpoints
    @app.route('/api/anomalies', methods=['GET'])
    @cache.cached(timeout=600)  # Cache for 10 minutes
    def get_anomalies():
        """Get top anomalous videos with analysis"""
        try:
            if not anomaly_detector or not anomaly_detector.fitted:
                return jsonify({'error': 'Anomaly detection not available'}), 503
            
            limit = min(request.args.get('limit', 100, type=int), 500)
            threshold = request.args.get('threshold', 0.5, type=float)
            
            # Get top anomalies
            top_anomalies = anomaly_detector.get_top_anomalies(limit, threshold)
            
            anomalies_list = []
            for video_id, score, reasons in top_anomalies:
                # Get video details
                video_row = video_data[video_data['video_id'] == video_id] if video_data is not None else pd.DataFrame()
                
                anomaly_info = {
                    'video_id': str(video_id),
                    'anomaly_score': float(score),
                    'reasons': reasons,
                    'title': str(video_row.iloc[0]['video-title']) if not video_row.empty else 'Unknown',
                    'main_event': str(video_row.iloc[0]['main-event']) if not video_row.empty else 'unknown'
                }
                
                # Add coordinates if available
                if not video_row.empty and coordinates_3d is not None:
                    row_index = video_row.index[0]
                    if row_index < len(coordinates_3d):
                        coords = coordinates_3d[row_index]
                        anomaly_info['coordinates'] = {
                            'x': float(coords[0]),
                            'y': float(coords[1]),
                            'z': float(coords[2])
                        }
                
                # Get detailed explanation
                explanation = anomaly_detector.get_anomaly_explanation(video_id)
                if explanation:
                    anomaly_info['detailed_analysis'] = {
                        'severity': explanation.get('severity', 'Unknown'),
                        'confidence': explanation.get('confidence', 0),
                        'component_scores': explanation.get('component_scores', {}),
                        'is_anomaly': explanation.get('is_anomaly', False)
                    }
                
                anomalies_list.append(anomaly_info)
            
            # Get overall statistics
            stats = anomaly_detector.get_anomaly_statistics()
            
            return jsonify({
                'anomalies': anomalies_list,
                'anomaly_stats': stats,
                'query_params': {
                    'limit': limit,
                    'threshold': threshold,
                    'total_returned': len(anomalies_list)
                }
            }), 200
            
        except Exception as e:
            app.logger.error(f"Error getting anomalies: {e}")
            return jsonify({'error': str(e)}), 500
    
    # Video streaming endpoints
    @app.route('/api/videos/<video_id>/thumbnail', methods=['GET'])
    def get_video_thumbnail(video_id):
        """Get video thumbnail image"""
        try:
            # Find video file path
            video_row = video_data[video_data['video_id'] == video_id] if video_data is not None else pd.DataFrame()
            
            if video_row.empty:
                return jsonify({'error': 'Video not found'}), 404
            
            video_path = video_row.iloc[0].get('video_path', '')
            
            if not video_path or not os.path.exists(video_path):
                # Return placeholder thumbnail
                return generate_placeholder_thumbnail(video_id)
            
            # Extract thumbnail from video
            try:
                cap = cv2.VideoCapture(video_path)
                if not cap.isOpened():
                    return generate_placeholder_thumbnail(video_id)
                
                # Seek to middle of video for thumbnail
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                middle_frame = frame_count // 2
                cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame)
                
                ret, frame = cap.read()
                cap.release()
                
                if not ret:
                    return generate_placeholder_thumbnail(video_id)
                
                # Convert to RGB and resize
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Resize to thumbnail size
                size = request.args.get('size', 'medium')
                if size == 'small':
                    thumbnail_size = (160, 120)
                elif size == 'large':
                    thumbnail_size = (320, 240)
                else:  # medium
                    thumbnail_size = (240, 180)
                
                frame_resized = cv2.resize(frame_rgb, thumbnail_size)
                
                # Convert to PIL Image and save to bytes
                pil_image = Image.fromarray(frame_resized)
                img_io = io.BytesIO()
                pil_image.save(img_io, 'JPEG', quality=85)
                img_io.seek(0)
                
                return Response(img_io.getvalue(), mimetype='image/jpeg')
                
            except Exception as e:
                app.logger.warning(f"Failed to extract thumbnail from {video_path}: {e}")
                return generate_placeholder_thumbnail(video_id)
            
        except Exception as e:
            app.logger.error(f"Error getting thumbnail: {e}")
            return jsonify({'error': str(e)}), 500
    
    def generate_placeholder_thumbnail(video_id):
        """Generate a placeholder thumbnail"""
        try:
            # Create a simple colored rectangle as placeholder
            width, height = 240, 180
            color = (100, 150, 200)  # Light blue
            
            # Create PIL image
            img = Image.new('RGB', (width, height), color)
            
            # Add text if PIL supports it
            try:
                from PIL import ImageDraw, ImageFont
                draw = ImageDraw.Draw(img)
                text = f"Video\n{video_id[:8]}..."
                
                # Try to use default font
                try:
                    font = ImageFont.load_default()
                except:
                    font = None
                
                # Calculate text position (center)
                if font:
                    bbox = draw.textbbox((0, 0), text, font=font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                else:
                    text_width, text_height = 100, 20
                
                x = (width - text_width) // 2
                y = (height - text_height) // 2
                
                draw.text((x, y), text, fill=(255, 255, 255), font=font)
                
            except ImportError:
                pass  # Skip text if ImageDraw not available
            
            # Convert to bytes
            img_io = io.BytesIO()
            img.save(img_io, 'JPEG', quality=85)
            img_io.seek(0)
            
            return Response(img_io.getvalue(), mimetype='image/jpeg')
            
        except Exception as e:
            app.logger.error(f"Error generating placeholder: {e}")
            return jsonify({'error': 'Thumbnail not available'}), 404
    
    @app.route('/api/videos/<video_id>/stream', methods=['GET'])
    def stream_video(video_id):
        """Stream video file with range request support"""
        try:
            # Find video file path
            video_row = video_data[video_data['video_id'] == video_id] if video_data is not None else pd.DataFrame()
            
            if video_row.empty:
                return jsonify({'error': 'Video not found'}), 404
            
            video_path = video_row.iloc[0].get('video_path', '')
            
            if not video_path or not os.path.exists(video_path):
                return jsonify({'error': 'Video file not found'}), 404
            
            # Get file info
            file_size = os.path.getsize(video_path)
            
            # Handle range requests
            range_header = request.headers.get('Range', None)
            if range_header:
                # Parse range header
                byte_start = 0
                byte_end = file_size - 1
                
                if range_header:
                    range_match = range_header.replace('bytes=', '').split('-')
                    byte_start = int(range_match[0]) if range_match[0] else 0
                    byte_end = int(range_match[1]) if range_match[1] else file_size - 1
                
                # Ensure valid range
                byte_start = max(0, byte_start)
                byte_end = min(file_size - 1, byte_end)
                content_length = byte_end - byte_start + 1
                
                def generate_video_stream():
                    with open(video_path, 'rb') as f:
                        f.seek(byte_start)
                        remaining = content_length
                        while remaining:
                            chunk_size = min(8192, remaining)
                            data = f.read(chunk_size)
                            if not data:
                                break
                            remaining -= len(data)
                            yield data
                
                # Get MIME type
                mime_type = mimetypes.guess_type(video_path)[0] or 'video/mp4'
                
                response = Response(
                    generate_video_stream(),
                    206,  # Partial Content
                    headers={
                        'Content-Type': mime_type,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': str(content_length),
                        'Content-Range': f'bytes {byte_start}-{byte_end}/{file_size}'
                    }
                )
                
                return response
            
            else:
                # Full file request
                mime_type = mimetypes.guess_type(video_path)[0] or 'video/mp4'
                return send_file(video_path, mimetype=mime_type)
            
        except Exception as e:
            app.logger.error(f"Error streaming video: {e}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/videos/<video_id>/download', methods=['GET'])
    def download_video(video_id):
        """Download original video file"""
        try:
            # Find video file path
            video_row = video_data[video_data['video_id'] == video_id] if video_data is not None else pd.DataFrame()
            
            if video_row.empty:
                return jsonify({'error': 'Video not found'}), 404
            
            video_path = video_row.iloc[0].get('video_path', '')
            
            if not video_path or not os.path.exists(video_path):
                return jsonify({'error': 'Video file not found'}), 404
            
            # Get original filename
            original_filename = os.path.basename(video_path)
            
            return send_file(
                video_path,
                as_attachment=True,
                download_name=f"{video_id}_{original_filename}"
            )
            
        except Exception as e:
            app.logger.error(f"Error downloading video: {e}")
            return jsonify({'error': str(e)}), 500
    
    return app  # Return the app with added endpoints