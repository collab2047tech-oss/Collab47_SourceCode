// Neural ranker inference - pure JS forward pass, zero runtime/library/API cost.
// Supports a logistic-regression head (1-layer NN) and a 2-layer MLP. Weights are
// trained OFFLINE (scripts/train-ranker.mjs, free CI) and loaded at serve time.

export type RankerModel =
  | { type: "logreg"; w: number[]; b: number }
  | { type: "mlp"; W1: number[][]; b1: number[]; W2: number[]; b2: number };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const relu = (z: number) => (z > 0 ? z : 0);

/** Predict P(engage) in [0,1] for a feature vector. ~microseconds, no deps. */
export function predict(features: number[], model: RankerModel): number {
  if (model.type === "logreg") {
    let z = model.b;
    for (let i = 0; i < model.w.length; i++) z += model.w[i] * (features[i] ?? 0);
    return sigmoid(z);
  }
  // MLP: hidden = relu(W1·x + b1); out = sigmoid(W2·hidden + b2)
  const h = model.b1.map((bi, j) => {
    let z = bi;
    const row = model.W1[j];
    for (let i = 0; i < row.length; i++) z += row[i] * (features[i] ?? 0);
    return relu(z);
  });
  let out = model.b2;
  for (let j = 0; j < h.length; j++) out += model.W2[j] * h[j];
  return sigmoid(out);
}

/** Basic shape validation before trusting a loaded model. */
export function isValidModel(m: unknown, nFeatures: number): m is RankerModel {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  if (x.type === "logreg") return Array.isArray(x.w) && x.w.length === nFeatures && typeof x.b === "number";
  if (x.type === "mlp")
    return Array.isArray(x.W1) && Array.isArray(x.b1) && Array.isArray(x.W2) && typeof x.b2 === "number" &&
      (x.W1 as unknown[]).every((r) => Array.isArray(r) && (r as unknown[]).length === nFeatures);
  return false;
}
