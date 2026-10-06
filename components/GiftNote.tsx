import { HeartIcon } from "./Icons";

export function GiftNote({ text, from }: { text: string; from: string }) {
  return (
    <section className="gift container" aria-label="A note for you">
      <details>
        <summary>
          <HeartIcon className="heart" /> A note for you
        </summary>
        <div className="note">
          {text}
          {from ? <span className="from">— {from}</span> : null}
        </div>
      </details>
    </section>
  );
}
