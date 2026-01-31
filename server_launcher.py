#!/usr/bin/env python3
"""
Purchase Requisition System - Backend Launcher
Starts the Node.js backend server and makes it accessible at pras:3001
Includes logging and automatic restart on failure
"""

import subprocess
import sys
import os
import time
import logging
from datetime import datetime
from pathlib import Path

# Setup logging
log_dir = Path(__file__).parent / 'logs'
log_dir.mkdir(exist_ok=True)

log_file = log_dir / f'backend_{datetime.now().strftime("%Y%m%d")}.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

# Set stdout to UTF-8 to handle Unicode characters
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

logger = logging.getLogger(__name__)

# Configuration
BACKEND_DIR = Path(__file__).parent / 'backend'
NODE_SCRIPT = 'server.js'
HOST = 'pras'
PORT = 3001
MAX_RETRIES = 5
RETRY_DELAY = 10  # seconds

def check_node_installed():
    """Check if Node.js is installed"""
    try:
        result = subprocess.run(['node', '--version'],
                              capture_output=True,
                              text=True,
                              check=True)
        logger.info(f"Node.js version: {result.stdout.strip()}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.error("Node.js is not installed or not in PATH")
        return False

def check_dependencies():
    """Check if node_modules exists"""
    node_modules = BACKEND_DIR / 'node_modules'
    if not node_modules.exists():
        logger.warning("node_modules not found. Running npm install...")
        try:
            subprocess.run(['npm', 'install'],
                         cwd=BACKEND_DIR,
                         check=True)
            logger.info("Dependencies installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install dependencies: {e}")
            return False
    return True

def start_backend_server():
    """Start the backend Node.js server"""
    logger.info("=" * 60)
    logger.info("Starting Purchase Requisition System Backend")
    logger.info(f"Backend Directory: {BACKEND_DIR}")
    logger.info(f"Server will be accessible at http://{HOST}:{PORT}")
    logger.info("=" * 60)

    # Check prerequisites
    if not check_node_installed():
        logger.error("Cannot start server: Node.js not installed")
        return None

    if not check_dependencies():
        logger.error("Cannot start server: Dependencies missing")
        return None

    # Set environment variables
    env = os.environ.copy()
    env['PORT'] = str(PORT)
    env['HOST'] = HOST

    # Start the server
    try:
        logger.info(f"Launching {NODE_SCRIPT}...")
        process = subprocess.Popen(
            ['node', NODE_SCRIPT],
            cwd=BACKEND_DIR,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1
        )

        logger.info(f"Backend server started with PID: {process.pid}")
        logger.info(f"Access the application at: http://{HOST}:{PORT}")

        return process

    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        return None

def monitor_server(process):
    """Monitor server output and log it"""
    try:
        # Read stdout and stderr in real-time
        while True:
            # Check if process is still running
            if process.poll() is not None:
                logger.warning(f"Server process terminated with code: {process.returncode}")
                return process.returncode

            # Read and log output
            output = process.stdout.readline()
            if output:
                logger.info(f"[SERVER] {output.strip()}")

            error = process.stderr.readline()
            if error:
                logger.error(f"[SERVER ERROR] {error.strip()}")

            # Small delay to prevent CPU spinning
            time.sleep(0.1)

    except KeyboardInterrupt:
        logger.info("Received shutdown signal...")
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            logger.warning("Process did not terminate gracefully, forcing shutdown...")
            process.kill()
        logger.info("Server stopped")
        return 0

def main():
    """Main function with retry logic"""
    retry_count = 0

    while retry_count < MAX_RETRIES:
        logger.info(f"\n{'='*60}")
        logger.info(f"Attempt {retry_count + 1} of {MAX_RETRIES}")
        logger.info(f"{'='*60}\n")

        process = start_backend_server()

        if process is None:
            logger.error("Failed to start server")
            retry_count += 1
            if retry_count < MAX_RETRIES:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            continue

        # Monitor the server
        return_code = monitor_server(process)

        if return_code == 0:
            # Clean shutdown
            logger.info("Server shutdown cleanly")
            break
        else:
            # Server crashed
            retry_count += 1
            if retry_count < MAX_RETRIES:
                logger.warning(f"Server crashed. Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                logger.error("Max retries reached. Exiting.")
                sys.exit(1)

    logger.info("Backend launcher stopped")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.critical(f"Critical error: {e}", exc_info=True)
        sys.exit(1)
