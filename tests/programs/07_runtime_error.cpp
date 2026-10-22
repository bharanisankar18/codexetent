#include <iostream>
using namespace std;

int main() {
    cout << "Before crash" << endl;
    volatile int zero = 0;
    int x = 10 / zero;   // division by zero -> SIGFPE
    cout << x << endl;
    return 0;
}
