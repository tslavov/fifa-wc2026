Prediction artifacts live here.

Rules:
- Files in this directory are predictions, not collected source data.
- Do not import this directory from collectors, normalizers, feature builders, or model-input builders.
- Do not use prediction artifacts as training data or future prediction inputs.
- Each prediction file must include artifactKind: "prediction" and excludeFromFuturePredictionInputs: true.
- If a future Monte Carlo or LLM-based prediction is added, it must keep the same contamination controls.
