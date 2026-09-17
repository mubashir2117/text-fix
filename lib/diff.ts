export interface DiffSegment {
  text: string;
  type: "same" | "removed" | "added";
}

function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

export function diffWords(original: string, corrected: string): DiffSegment[] {
  const a = tokenize(original);
  const b = tokenize(corrected);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segs: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  const push = (text: string, type: DiffSegment["type"]) => {
    const last = segs[segs.length - 1];
    if (last && last.type === type) {
      last.text += text;
    } else {
      segs.push({ text, type });
    }
  };

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(a[i], "same");
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(a[i], "removed");
      i++;
    } else {
      push(b[j], "added");
      j++;
    }
  }

  while (i < n) {
    push(a[i], "removed");
    i++;
  }
  while (j < m) {
    push(b[j], "added");
    j++;
  }

  return segs;
}