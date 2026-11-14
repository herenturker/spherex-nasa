.PHONY: all clean

all: engine

engine: engine.cpp
	g++ -O3 -std=c++17 \
	-Wall -Wextra -Wpedantic -Wshadow \
	-Wformat=2 -Wfloat-equal -Wcast-align -Wpointer-arith -Wstrict-overflow=5 \
	-Wwrite-strings -Wno-unused-parameter -fstack-protector-strong \
	-o engine engine.cpp

clean:
	rm -f engine