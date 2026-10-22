#include <bits/stdc++.h>
using namespace std;

int factorial(int n) { return n <= 1 ? 1 : n * factorial(n - 1); }

void swapByRef(int &a, int &b) { int t = a; a = b; b = t; }

int main() {
    cout << "5! = " << factorial(5) << endl;
    int x = 1, y = 2;
    swapByRef(x, y);
    cout << "x=" << x << " y=" << y << endl;
    vector<int> v = {3, 1, 2};
    sort(v.begin(), v.end());
    for (int n : v) cout << n;
    cout << endl;
    return 0;
}
