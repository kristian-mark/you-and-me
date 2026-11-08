import { useEffect, useState, type ReactNode } from "react";
import type { Wish } from "@/lib/couple-store";
import { getWishPhoto } from "@/lib/pair-wishes";

const cache = new Map<string, string>();

function inlinePhoto(wish: Wish) {
  if (!wish.photo) return "";
  if (wish.photo.startsWith("data:") || wish.photo.startsWith("blob:")) return wish.photo;
  if (/^https?:\/\//i.test(wish.photo) && !wish.photo.includes("/storage/v1/object/public/wishes/")) return wish.photo;
  return "";
}

function useWishSrc(wish: Wish) {
  const inline = inlinePhoto(wish);
  const path = wish.photoPath ?? "";
  const [remote, setRemote] = useState(() => (path ? cache.get(path) ?? "" : ""));

  useEffect(() => {
    if (inline || !path) return;
    const cached = cache.get(path);
    if (cached) {
      setRemote(cached);
      return;
    }
    let stop = false;
    void getWishPhoto({ data: wish.id })
      .then((url) => {
        if (!url || stop) return;
        cache.set(path, url);
        setRemote(url);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [inline, path, wish.id]);

  return inline || remote;
}

export function WishPhoto({
  wish,
  className,
  fallback,
}: {
  wish: Wish;
  className?: string;
  fallback?: ReactNode;
}) {
  const src = useWishSrc(wish);
  if (!src) return fallback ?? null;
  return <img src={src} alt="" className={className} />;
}
