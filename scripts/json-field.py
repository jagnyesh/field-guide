import json
import sys

print(json.load(open(sys.argv[1]))[sys.argv[2]])
