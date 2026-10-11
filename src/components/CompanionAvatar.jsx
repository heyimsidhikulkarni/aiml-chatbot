export function getCompanion() {
  try {
    return {
      name: localStorage.getItem("companionName") || localStorage.getItem("characterName") || "Milo",
      avatar: localStorage.getItem("companionAvatar") || localStorage.getItem("characterAvatar") || ""
    };
  } catch {
    return { name: "Milo", avatar: "" };
  }
}

export default function CompanionAvatar({ name = "Milo", avatar = "", className = "avatar" }) {
  return (
    <span className={className} aria-label={`${name} avatar`}>
      {avatar ? <img src={avatar} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}
