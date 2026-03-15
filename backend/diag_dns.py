import socket
import sys

def diag(host):
    print(f"--- Diagnosing {host} ---")
    
    print("\n1. socket.gethostbyname:")
    try:
        print(socket.gethostbyname(host))
    except Exception as e:
        print(f"Error: {e}")

    print("\n2. socket.getaddrinfo (Default):")
    try:
        results = socket.getaddrinfo(host, 443)
        for r in results:
            print(f"  Family: {r[0]}, Address: {r[4]}")
    except Exception as e:
        print(f"Error: {e}")

    print("\n3. socket.getaddrinfo (Force AF_INET - IPv4):")
    try:
        results = socket.getaddrinfo(host, 443, family=socket.AF_INET)
        for r in results:
            print(f"  Family: {r[0]}, Address: {r[4]}")
    except Exception as e:
        print(f"Error: {e}")

    print("\n4. socket.getaddrinfo (Force AF_INET6 - IPv6):")
    try:
        results = socket.getaddrinfo(host, 443, family=socket.AF_INET6)
        for r in results:
            print(f"  Family: {r[0]}, Address: {r[4]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    diag("www.youtube.com")
    diag("google.com")
