#include <stdio.h>

int main() {
    int i;
    for (i = 1; i <= 3; ++i) {
        printf("%d squared = %d\n", i, i * i);
    }
    printf("%.2f\n", 7 / 2.0);
    printf("%d\n", 7 / 2);
    return 0;
}
