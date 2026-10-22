import java.util.*;

class Helper {
    static String twice(String s) { return s + s; }
}

public class GFG {
    static int square(int x) { return x * x; }

    public static void main(String[] args) {
        System.out.println("Square: " + GFG.square(5));
        System.out.println(Helper.twice("ab"));
        int[] arr = {3, 1, 2};
        Arrays.sort(arr);
        System.out.println(Arrays.toString(arr));
    }
}
