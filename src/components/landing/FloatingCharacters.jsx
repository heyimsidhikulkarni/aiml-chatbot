const CHARACTERS = [
  "angry", "crying", "screaming", "anxious", "cool", "blushing", "winking", "sleeping", "happy"
];

export default function FloatingCharacters() {
  return (
    <div className="lp-floating-characters" aria-hidden="true">
      {CHARACTERS.map((name) => (
        <img
          key={name}
          className={`lp-floating-character lp-character--${name}`}
          src={`/characters/${name}.png`}
          alt=""
          decoding="async"
        />
      ))}
    </div>
  );
}
