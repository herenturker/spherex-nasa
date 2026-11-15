import os
import subprocess
import random
import sys

# Configuration for the test suite
MATRIX_SIZE = 20
THRESHOLD = 50.0
EXECUTABLE = "./engine"

def generate_random_matrix(size, object_type="none"):
    """
    Generates a 2D matrix of floats with random noise and specific test objects.
    """
    matrix = [[0.0 for _ in range(size)] for _ in range(size)]
    
    # Add random background noise (values below the threshold)
    for i in range(size):
        for j in range(size):
            if random.random() < 0.1:
                matrix[i][j] = random.uniform(1.0, 30.0)

    # Inject specific test cases based on the object_type
    if object_type == "single":
        x, y = random.randint(2, size - 3), random.randint(2, size - 3)
        matrix[y][x] = random.uniform(100.0, 500.0)
        
    elif object_type == "cluster":
        # Create a 2x2 cluster
        x, y = random.randint(2, size - 4), random.randint(2, size - 4)
        for dy in range(2):
            for dx in range(2):
                matrix[y + dy][x + dx] = random.uniform(100.0, 500.0)
                
    return matrix

def write_matrix_to_file(matrix, filename):
    """Writes a 2D matrix to a text file, space-separated."""
    with open(filename, "w") as f:
        for row in matrix:
            f.write(" ".join(f"{val:.2f}" for val in row) + "\n")

def run_engine_test(test_name, file1, file2, expected_output_prefix):
    """Runs the C++ engine and validates the output format."""
    print(f"[TEST] {test_name}")
    
    try:
        # Execute the C++ binary
        result = subprocess.run(
            [EXECUTABLE, file1, file2, str(THRESHOLD)],
            capture_output=True,
            text=True,
            check=True
        )
        
        output = result.stdout.strip()
        
        # Validate output
        if expected_output_prefix in output:
            print(f"  Result: PASS")
            print(f"  Engine Output: {output}")
        else:
            print(f"  Result: FAIL (Unexpected output)")
            print(f"  Expected to contain: {expected_output_prefix}")
            print(f"  Actual Output: {output}")
            
    except subprocess.CalledProcessError as e:
        print(f"  Result: CRASH")
        print(f"  Error: {e.stderr}")
    except FileNotFoundError:
        print(f"  Result: ERROR")
        print(f"  Could not find '{EXECUTABLE}'. Ensure it is compiled and in the current directory.")
        sys.exit(1)
    
    print("-" * 40)

def cleanup_files(*files):
    """Removes temporary test files."""
    for file in files:
        if os.path.exists(file):
            os.remove(file)

def main():
    file_old = "test_old.txt"
    file_new = "test_new.txt"
    
    print(f"Starting Engine Test Suite (Matrix Size: {MATRIX_SIZE}x{MATRIX_SIZE}, Threshold: {THRESHOLD})")
    print("=" * 40)

    # Test 1: Identical Images (No difference)
    m_empty = generate_random_matrix(MATRIX_SIZE, "none")
    write_matrix_to_file(m_empty, file_old)
    write_matrix_to_file(m_empty, file_new)
    run_engine_test("Identical Images", file_old, file_new, "TESPIT_YOK")

    # Test 2: Single Moving Object
    m_old_single = generate_random_matrix(MATRIX_SIZE, "single")
    m_new_single = generate_random_matrix(MATRIX_SIZE, "none")
    write_matrix_to_file(m_old_single, file_old)
    write_matrix_to_file(m_new_single, file_new)
    run_engine_test("Single Object Detection", file_old, file_new, "TESPIT_EDILDI")

    # Test 3: Clustered Object (Blob Detection)
    m_old_cluster = generate_random_matrix(MATRIX_SIZE, "cluster")
    m_new_cluster = generate_random_matrix(MATRIX_SIZE, "none")
    write_matrix_to_file(m_old_cluster, file_old)
    write_matrix_to_file(m_new_cluster, file_new)
    run_engine_test("Clustered Object Detection", file_old, file_new, "TESPIT_EDILDI")

    # Cleanup
    cleanup_files(file_old, file_new)
    print("Test suite completed. Temporary files removed.")

if __name__ == "__main__":
    main()