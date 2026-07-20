export type BingoCell = {
    number: number | "FREE";
    marked: boolean;
    isWinningCell: boolean;
};

export class BingoEngine {
    public static generateBoard(): BingoCell[][] {
        const board: BingoCell[][] = [];
        const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];

        for (let r = 0; r < 5; r++) {
            board[r] = [];
        }

        for (let col = 0; col < 5; col++) {
            const pool = this.shuffle(Array.from({ length: 15 }, (_, i) => i + ranges[col][0]));
            for (let row = 0; row < 5; row++) {
                if (row === 2 && col === 2) {
                    board[row][col] = { number: "FREE", marked: true, isWinningCell: false };
                } else {
                    board[row][col] = { number: pool[row], marked: false, isWinningCell: false };
                }
            }
        }
        return board;
    }

    private static shuffle(array: any[]) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    public static checkWins(board: BingoCell[][]): { patterns: number[][], isXPattern: boolean, isFourCorners: boolean } {
        const patterns: number[][] = [];

        // 0-4 rows, 5-9 cols, 10 diag1, 11 diag2

        // Rows
        for (let r = 0; r < 5; r++) {
            if ([0,1,2,3,4].every(c => board[r][c].marked)) patterns.push([r, 0, r, 1, r, 2, r, 3, r, 4]);
        }
        // Cols
        for (let c = 0; c < 5; c++) {
            if ([0,1,2,3,4].every(r => board[r][c].marked)) patterns.push([0, c, 1, c, 2, c, 3, c, 4, c]);
        }
        // Diagonals
        if ([0,1,2,3,4].every(i => board[i][i].marked)) patterns.push([0,0, 1,1, 2,2, 3,3, 4,4]);
        if ([0,1,2,3,4].every(i => board[i][4-i].marked)) patterns.push([0,4, 1,3, 2,2, 3,1, 4,0]);

        const diag1Full = [0,1,2,3,4].every(i => board[i][i].marked);
        const diag2Full = [0,1,2,3,4].every(i => board[i][4-i].marked);

        // Four Corners
        const fourCornersFull = board[0][0].marked && board[0][4].marked && board[4][0].marked && board[4][4].marked;
        if (fourCornersFull) patterns.push([0,0, 0,4, 4,0, 4,4]);

        return {
            patterns,
            isXPattern: diag1Full && diag2Full,
            isFourCorners: fourCornersFull
        };
    }
}
