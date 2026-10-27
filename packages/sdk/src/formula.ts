/**
 * Tiny arithmetic language for computed sheet fields, e.g. `floor((@str - 10) / 2) + @proficiency`.
 * Supports numbers, `@field` references, + - * / %, parentheses and floor/ceil/round/abs/min/max.
 * It is a pure expression evaluator: no access to anything beyond the supplied variables.
 */
export class FormulaError extends Error {}

export type FormulaNode =
  | { kind: "num"; value: number }
  | { kind: "ref"; name: string }
  | { kind: "neg"; operand: FormulaNode }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "%"; left: FormulaNode; right: FormulaNode }
  | { kind: "call"; fn: string; args: FormulaNode[] };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
};

const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|@([a-z][a-z0-9_]*)|([a-z]+)|([-+*/%(),]))/giy;

export function parseFormula(source: string): FormulaNode {
  const tokens: { type: "num" | "ref" | "ident" | "op"; text: string }[] = [];
  TOKEN.lastIndex = 0;
  let end = 0;
  for (let m = TOKEN.exec(source); m; m = TOKEN.exec(source)) {
    end = TOKEN.lastIndex;
    if (m[1] !== undefined) tokens.push({ type: "num", text: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: "ref", text: m[2] });
    else if (m[3] !== undefined) tokens.push({ type: "ident", text: m[3].toLowerCase() });
    else tokens.push({ type: "op", text: m[4]! });
  }
  if (source.slice(end).trim() !== "") throw new FormulaError(`unexpected character at ${end}`);

  let pos = 0;
  const peek = () => tokens[pos];
  const takeOp = (text: string) => (peek()?.type === "op" && peek()!.text === text ? (pos++, true) : false);

  const parseExpression = (): FormulaNode => {
    let left = parseTerm();
    for (;;) {
      const op = takeOp("+") ? "+" : takeOp("-") ? "-" : null;
      if (!op) return left;
      left = { kind: "bin", op, left, right: parseTerm() };
    }
  };
  const parseTerm = (): FormulaNode => {
    let left = parseUnary();
    for (;;) {
      const op = takeOp("*") ? "*" : takeOp("/") ? "/" : takeOp("%") ? "%" : null;
      if (!op) return left;
      left = { kind: "bin", op, left, right: parseUnary() };
    }
  };
  const parseUnary = (): FormulaNode => (takeOp("-") ? { kind: "neg", operand: parseUnary() } : parsePrimary());
  const parsePrimary = (): FormulaNode => {
    const token = tokens[pos++];
    if (!token) throw new FormulaError("unexpected end");
    if (token.type === "num") return { kind: "num", value: Number(token.text) };
    if (token.type === "ref") return { kind: "ref", name: token.text };
    if (token.type === "ident") {
      if (!(token.text in FUNCTIONS)) throw new FormulaError(`unknown function ${token.text}`);
      if (!takeOp("(")) throw new FormulaError("expected (");
      const args: FormulaNode[] = [];
      if (!takeOp(")")) {
        do args.push(parseExpression());
        while (takeOp(","));
        if (!takeOp(")")) throw new FormulaError("expected )");
      }
      return { kind: "call", fn: token.text, args };
    }
    if (token.text === "(") {
      const inner = parseExpression();
      if (!takeOp(")")) throw new FormulaError("expected )");
      return inner;
    }
    throw new FormulaError(`unexpected ${token.text}`);
  };

  const ast = parseExpression();
  if (pos < tokens.length) throw new FormulaError(`unexpected ${tokens[pos]!.text}`);
  return ast;
}

/** Names referenced by a formula; used to detect missing fields and cycles. */
export function formulaReferences(node: FormulaNode): string[] {
  switch (node.kind) {
    case "num":
      return [];
    case "ref":
      return [node.name];
    case "neg":
      return formulaReferences(node.operand);
    case "bin":
      return [...formulaReferences(node.left), ...formulaReferences(node.right)];
    case "call":
      return node.args.flatMap(formulaReferences);
  }
}

export function evaluateFormula(node: FormulaNode, resolve: (name: string) => number): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "ref":
      return resolve(node.name);
    case "neg":
      return -evaluateFormula(node.operand, resolve);
    case "call":
      return FUNCTIONS[node.fn]!(...node.args.map((a) => evaluateFormula(a, resolve)));
    case "bin": {
      const l = evaluateFormula(node.left, resolve);
      const r = evaluateFormula(node.right, resolve);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? NaN : l / r;
        case "%":
          return r === 0 ? NaN : l % r;
      }
    }
  }
}
