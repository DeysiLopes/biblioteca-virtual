import React, { useEffect, useRef } from 'react';

/**
 * Gatinho de CSS puro na beirada da prateleira. Em repouso ele balança a
 * cauda e dá petelecos no último livro; ao rolar a página ele estica a
 * pata e "tenta derrubar" o livro (que balança sem cair).
 */
export const ShelfCat: React.FC = () => {
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cat = catRef.current;
    if (!cat) return;

    let cooling = false;
    const onScroll = () => {
      if (cooling) return;
      cooling = true;
      cat.classList.add('batting');
      const wood = cat.closest('.shelf-wood');
      const books = wood?.querySelectorAll('.book-card');
      const last = books?.length ? books[books.length - 1] : null;
      last?.classList.add('cat-wobble');
      window.setTimeout(() => {
        cat.classList.remove('batting');
        last?.classList.remove('cat-wobble');
        cooling = false;
      }, 950);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="shelf-cat" ref={catRef} aria-hidden="true">
      <span className="cat-tail" />
      <span className="cat-body" />
      <span className="cat-paw" />
      <span className="cat-head">
        <i className="cat-ear e-l" />
        <i className="cat-ear e-r" />
        <i className="cat-eye y-l" />
        <i className="cat-eye y-r" />
      </span>
    </div>
  );
};
