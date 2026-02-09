interface Props {
  labels: Record<string, string>; // e.g. { "0": "komondor", "1": "mop" }
  weights: Record<string, number>; // label name to weight
  onChange: (weights: Record<string, number>) => void;
}

export default function WeightSlider({ labels, weights, onChange }: Props) {
  const labelNames = Object.values(labels);

  const STEP = 0.05;
  const MIN = -2.0;
  const MAX = 2.0;

  const handleChange = (labelName: string, value: number) => {
    onChange({ ...weights, [labelName]: value });
  };

  const handleStep = (labelName: string, delta: number) => {
    const cur = weights[labelName] ?? 0;
    const next = Math.round((cur + delta) * 100) / 100;
    if (next >= MIN && next <= MAX) handleChange(labelName, next);
  };

  return (
    <weight-sliders>
      {labelNames.map((labelName) => (
        <weight-slider-row key={labelName}>
          <label-name>{labelName}</label-name>
          <button type="button" step-btn="" onClick={() => handleStep(labelName, -STEP)}>−</button>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={STEP}
            value={weights[labelName] ?? 0}
            onChange={(e) => handleChange(labelName, parseFloat(e.target.value))}
          />
          <button type="button" step-btn="" onClick={() => handleStep(labelName, STEP)}>+</button>
          <weight-value>
            {(weights[labelName] ?? 0).toFixed(2)}
          </weight-value>
        </weight-slider-row>
      ))}
    </weight-sliders>
  );
}
