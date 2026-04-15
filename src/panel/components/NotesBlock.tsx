import { useState, useEffect, useRef } from 'react';
import { getNotes, setNotes } from '../storage';

const MAX_LENGTH = 4096;
const DEBOUNCE_MS = 300;

interface Props {
  username: string | null;
  subreddit: string;
}

export function NotesBlock({ username, subreddit }: Props) {
  const [text, setText] = useState(() => getNotes(username, subreddit));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(getNotes(username, subreddit));
  }, [username, subreddit]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);

    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setNotes(username, subreddit, value);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  }

  return (
    <div className="r3-section">
      <div className="r3-section__heading">My Notes</div>
      <textarea
        className="r3-notes__textarea"
        value={text}
        onChange={handleChange}
        maxLength={MAX_LENGTH}
        placeholder="Notes about this subreddit…"
      />
      <div className="r3-notes__count">
        {text.length} / {MAX_LENGTH}
      </div>
    </div>
  );
}
