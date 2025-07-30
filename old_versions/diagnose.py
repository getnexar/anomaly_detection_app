#!/usr/bin/env python3
import requests
import time
import sys

BASE_URL = "http://localhost:8200"

def test_endpoint(name, url):
    print(f"\n📍 Testing {name}...")
    start = time.time()
    try:
        response = requests.get(url, timeout=10)
        elapsed = time.time() - start
        print(f"✅ Status: {response.status_code}")
        print(f"⏱️  Time: {elapsed:.2f}s")
        if response.status_code == 200:
            data = response.json()
            if 'videos' in data:
                print(f"📊 Videos: {len(data['videos'])}")
            elif 'clusters' in data:
                print(f"📊 Clusters: {len(data['clusters'])}")
            elif 'status' in data:
                print(f"📊 Status: {data['status']}")
        else:
            print(f"❌ Error: {response.text[:200]}")
    except requests.exceptions.Timeout:
        print(f"❌ TIMEOUT after 10 seconds!")
    except Exception as e:
        print(f"❌ ERROR: {e}")

print("🔍 Diagnosing Anomaly Detection App...")

# Test endpoints
test_endpoint("Health Check", f"{BASE_URL}/api/health")
test_endpoint("Videos (5 items)", f"{BASE_URL}/api/videos?page=1&per_page=5")
test_endpoint("Clusters", f"{BASE_URL}/api/clusters")
test_endpoint("Metadata Filters", f"{BASE_URL}/api/metadata/filters")

print("\n✅ Diagnosis complete!")