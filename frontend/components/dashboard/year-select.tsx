type YearSelectProps = {
  value: number | string;
  years: number[];
  disabled?: boolean;
  onChange: (year: number) => void;
};

export function YearSelect({
  value,
  years,
  disabled = false,
  onChange,
}: YearSelectProps) {
  return (
    <select
      aria-label="Ano"
      className="h-10 rounded-lg border border-[#4a4880] bg-[#181642] px-3 text-sm text-zinc-100 outline-none"
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}
