// The mobile history drawer.
//
// A native <dialog> is not a good fit here: the sidebar is a permanent part of
// the desktop layout, and the desktop shell is the same element. So the drawer
// is the existing sidebar, moved off-canvas by CSS, and while it is open the
// rest of the page is made `inert` — which removes the background from the tab
// order *and* from the accessibility tree — with `aria-hidden` set alongside for
// older assistive tech. Body scrolling is locked and Tab wraps inside the panel.

const NARROW = '(max-width: 820px)';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createDrawer({ panel, backdrop, opener, background = [] }) {
  const query = window.matchMedia(NARROW);
  let open = false;
  let openerFocus = null;

  function isNarrow() {
    return query.matches;
  }

  function focusable() {
    return [...panel.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null);
  }

  /** Keep the closed drawer unreachable at narrow widths, and open at wide ones. */
  function syncMode() {
    if (!isNarrow() && open) close({ restoreFocus: false });
    panel.inert = isNarrow() && !open;
    opener.hidden = !isNarrow();
    if (!isNarrow()) {
      panel.classList.remove('sidebar--drawer');
      backdrop.hidden = true;
    }
  }

  function setBackgroundInert(inert) {
    for (const node of background) {
      if (!node) continue;
      node.inert = inert;
      if (inert) node.setAttribute('aria-hidden', 'true');
      else node.removeAttribute('aria-hidden');
    }
  }

  function openDrawer() {
    if (!isNarrow() || open) return;
    open = true;
    openerFocus = document.activeElement;
    panel.inert = false;
    panel.classList.add('sidebar--drawer');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    opener.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    document.body.classList.add('drawer-open');
    setBackgroundInert(true);
    panel.addEventListener('keydown', onKeydown);
    const first = focusable()[0];
    if (first) first.focus();
    else panel.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false;
    panel.removeEventListener('keydown', onKeydown);
    panel.classList.remove('sidebar--drawer');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    opener.setAttribute('aria-expanded', 'false');
    backdrop.hidden = true;
    document.body.classList.remove('drawer-open');
    setBackgroundInert(false);
    panel.inert = isNarrow();
    if (restoreFocus) {
      const target = openerFocus instanceof HTMLElement && openerFocus.isConnected ? openerFocus : opener;
      target.focus();
    }
  }

  // With the background inert this only matters for the wrap-around ends, but it
  // keeps focus inside the panel even if a browser ignores `inert`.
  function onKeydown(event) {
    if (event.key !== 'Tab') return;
    const nodes = focusable();
    if (nodes.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  query.addEventListener('change', syncMode);
  backdrop.addEventListener('click', () => close());
  opener.addEventListener('click', () => (open ? close() : openDrawer()));
  syncMode();

  return {
    isOpen: () => open,
    open: openDrawer,
    close,
    syncMode
  };
}
