import threading
import time
import random
from graph_logic import insert_graph_data

def stress_test():
    test_data = {
        "nodes": [
            {"name": "Git", "type": "tool"},
            {"name": "Version Control", "type": "concept"},
            {"name": "Snapshot", "type": "method"}
        ],
        "edges": [
            {"source": "Git", "target": "Version Control", "relation": "is a"},
            {"source": "Git", "target": "Snapshot", "relation": "uses"}
        ]
    }
    
    threads = []
    print("Starting concurrent graph insertion stress test...")
    # Increase to 8 threads to really stress it
    for i in range(8):
        t = threading.Thread(target=insert_graph_data, args=(test_data, "http://test.com", f"session-stress-{i}"))
        threads.append(t)
        # Small delay to stagger them slightly
        time.sleep(0.2)
        t.start()
        
    for t in threads:
        t.join()
    print("Stress test complete. Check logs for success.")

if __name__ == "__main__":
    stress_test()
