import subprocess
import platform
import json
import sys
import re

def ping(host):
    """
    Returns a dictionary with status, latency info, and raw output.
    """
    # Determine the operating system
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    
    # Run the ping command
    command = ['ping', param, '4', host]
    
    try:
        output = subprocess.check_output(command, stderr=subprocess.STDOUT, universal_newlines=True)
        
        # Parse the output
        # Windows example: Average = 12ms
        # Unix example: avg = 12.345 ms
        
        results = {
            "host": host,
            "status": "online",
            "latency_avg": None,
            "packet_loss": None,
            "raw": output
        }
        
        # Extract average latency
        avg_match = re.search(r'Average = (\d+)ms', output) if platform.system().lower() == 'windows' else re.search(r'avg = ([\d\.]+)', output)
        if avg_match:
            results["latency_avg"] = avg_match.group(1)
            
        # Extract packet loss
        loss_match = re.search(r'\((\d+)% loss\)', output)
        if loss_match:
            results["packet_loss"] = loss_match.group(1)
            
        return results

    except subprocess.CalledProcessError as e:
        return {
            "host": host,
            "status": "offline",
            "error": str(e),
            "raw": e.output if hasattr(e, 'output') else ""
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No host provided"}))
        sys.exit(1)
    
    host_to_ping = sys.argv[1]
    print(json.dumps(ping(host_to_ping), indent=2))
