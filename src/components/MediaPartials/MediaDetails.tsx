import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { playerStore } from "@stores";
import { hostResolver } from "@utils";

export default function() {
  let titleRef!: HTMLAnchorElement;
  let titleTextRef!: HTMLSpanElement;
  let resizeObserver: ResizeObserver | undefined;
  const [marqueeDistance, setMarqueeDistance] = createSignal(0);

  function updateMarquee() {
    window.requestAnimationFrame(() => {
      if (!titleRef || !titleTextRef) return;
      setMarqueeDistance(Math.max(0, titleTextRef.scrollWidth - titleRef.clientWidth));
    });
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(updateMarquee);
    resizeObserver.observe(titleRef);
    resizeObserver.observe(titleTextRef);
    updateMarquee();
  });

  createEffect(() => {
    playerStore.status;
    playerStore.stream.title;
    updateMarquee();
  });

  onCleanup(() => resizeObserver?.disconnect());

  return (
    <div class="mediaDetails">
      <a
        id="title"
        ref={titleRef}
        classList={{ 'mediaDetails__title--marquee': marqueeDistance() > 0 }}
        style={{ '--marquee-distance': `${marqueeDistance()}px` }}
        href={hostResolver(`/watch?v=${playerStore.stream.id}`)}
        target="_blank"
      >
        <span ref={titleTextRef}>{playerStore.status || playerStore.stream.title}</span>
      </a>
      <p id="author">{playerStore.stream.author?.replace('- Topic', '') ?? ''}</p>
    </div>
  );

}
