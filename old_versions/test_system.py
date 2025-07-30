#!/usr/bin/env python3
"""
Test script to verify the video analysis system works end-to-end
"""

import os
import sys
import pandas as pd
import json

def test_bootstrap_data():
    """Test that bootstrap created the required data files"""
    print("🧪 Testing bootstrap data...")
    
    required_files = [
        'data/df_gemini.csv',
        'data/cluster_info.json',
        'data/processed/coordinates_3d.npy',
        'data/processed/embeddings.npy'
    ]
    
    for file_path in required_files:
        if not os.path.exists(file_path):
            print(f"❌ Missing file: {file_path}")
            return False
        else:
            print(f"✅ Found: {file_path}")
    
    # Test data content
    df = pd.read_csv('data/df_gemini.csv')
    print(f"✅ Video data: {len(df)} videos loaded")
    
    with open('data/cluster_info.json', 'r') as f:
        clusters = json.load(f)
    print(f"✅ Cluster data: {len(clusters)} clusters loaded")
    
    return True

def test_flask_imports():
    """Test that Flask app can import dependencies"""
    print("🧪 Testing Flask imports...")
    
    try:
        # Test basic imports that don't require ML libraries
        import pandas as pd
        import numpy as np
        import json
        import os
        from pathlib import Path
        print("✅ Basic dependencies imported successfully")
        
        # Test Flask specific imports (might fail if not installed)
        try:
            from flask import Flask, request, jsonify
            print("✅ Flask imports successful")
        except ImportError as e:
            print(f"⚠️  Flask not available: {e}")
            print("   Install with: pip install flask flask-cors flask-caching")
            return False
        
        return True
        
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False

def test_frontend_files():
    """Test that frontend files exist"""
    print("🧪 Testing frontend files...")
    
    required_files = [
        'frontend/index.html',
        'frontend/js/main.js',
        'frontend/js/components/VideoVisualization3D.js',
        'frontend/js/components/ControlPanel.js',
        'frontend/js/components/DetailModal.js',
        'frontend/js/components/VideoPlayer.js',
        'frontend/js/services/APIClient.js',
        'frontend/js/utils/EventBus.js',
        'frontend/js/utils/PerformanceMonitor.js',
        'frontend/css/main.css',
        'frontend/css/components.css'
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
        else:
            print(f"✅ Found: {file_path}")
    
    if missing_files:
        print(f"❌ Missing files: {missing_files}")
        return False
    
    return True

def test_data_integrity():
    """Test that the data makes sense"""
    print("🧪 Testing data integrity...")
    
    df = pd.read_csv('data/df_gemini.csv')
    
    # Check required columns
    required_columns = ['video_id', 'x', 'y', 'z', 'anomaly_score', 'cluster_id']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        print(f"❌ Missing columns: {missing_columns}")
        return False
    
    # Check data ranges
    if not (df['x'].between(-50, 50).all()):
        print("⚠️  X coordinates outside expected range")
    
    if not (df['anomaly_score'].between(0, 1).all()):
        print("❌ Anomaly scores outside [0,1] range")
        return False
    
    # Check cluster distribution
    cluster_counts = df['cluster_id'].value_counts()
    print(f"✅ Cluster distribution: {len(cluster_counts)} clusters")
    print(f"   Largest cluster: {cluster_counts.iloc[0]} videos")
    print(f"   Smallest cluster: {cluster_counts.iloc[-1]} videos")
    
    return True

def generate_test_report():
    """Generate a comprehensive test report"""
    print("🎯 Generating System Test Report")
    print("=" * 50)
    
    tests = [
        ("Bootstrap Data", test_bootstrap_data),
        ("Flask Imports", test_flask_imports),
        ("Frontend Files", test_frontend_files),
        ("Data Integrity", test_data_integrity)
    ]
    
    results = {}
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        print("-" * 30)
        results[test_name] = test_func()
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name:20} {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
        print("\n📋 Next Steps:")
        print("1. pip install -r requirements.txt")
        print("2. python backend/app.py")
        print("3. Open http://localhost:5000")
        print("\n🎮 Expected Functionality:")
        print("- 3D visualization with 1000 sample points")
        print("- Click any point to see video details")
        print("- Use filters and search (sample data)")
        print("- Camera controls and navigation")
        print("- Performance monitoring")
    else:
        print("❌ SOME TESTS FAILED")
        print("Please fix the issues above before running the system")
    
    return all_passed

if __name__ == '__main__':
    success = generate_test_report()
    sys.exit(0 if success else 1)