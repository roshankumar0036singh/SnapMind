
import requests
import json

def test_graph_endpoints():
    base_url = "http://localhost:7860"
    
    print("--- Testing /graph/sessions ---")
    try:
        resp = requests.get(f"{base_url}/graph/sessions")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            sessions = resp.json()
            print(f"Sessions count: {len(sessions)}")
            print(json.dumps(sessions, indent=2))
        else:
            print(f"Error: {resp.text}")
    except Exception as e:
        print(f"Exception: {e}")

    print("\n--- Testing /graph/data ---")
    try:
        resp = requests.get(f"{base_url}/graph/data")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            nodes = data.get("nodes", [])
            edges = data.get("edges", [])
            print(f"Nodes: {len(nodes)}, Edges: {len(edges)}")
            if nodes:
                print("First node sample:", nodes[0])
            if edges:
                print("First edge sample:", edges[0])
        else:
            print(f"Error: {resp.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_graph_endpoints()
