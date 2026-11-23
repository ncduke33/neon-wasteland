/* NEON WASTELAND — story layer.
   Five acts, one per battleground. Pure DOM, no dependencies. */
(function () {
  "use strict";

  var ACTS = [
    {
      num: "I",
      title: "BROWNOUT",
      tag: "THE GRID DIES FIRST",
      hook: "The city loses power in rings, and the Core Spire is the only thing still lit.",
      brief: "You are an operator with a printer, a stolen hero licence and eleven minutes of battery. " +
             "Corporate security was already on the street when the lights went out. They are not here to help.",
      beat: "Spire holds. The grid answers to you now, one ring at a time."
    },
    {
      num: "II",
      title: "GHOST FREQUENCY",
      tag: "SOMETHING IS RIDING THE LANES",
      hook: "A signal is steering the waves. It knows your build order before you do.",
      brief: "Every lane carries a carrier tone underneath the noise. Break it and the hostiles walk blind. " +
             "The cipher is a nine-by-nine stack: three slabs, no digit repeated down a column. NEON RX. Learn it.",
      beat: "Cipher cracked. The lanes go quiet for the first time in a week."
    },
    {
      num: "III",
      title: "THE QUIET AUCTION",
      tag: "THEY ARE BIDDING ON YOUR DISTRICT",
      hook: "Four corporations are auctioning the last lit block. You are the lot.",
      brief: "Bids come in as security contracts. Every wave you survive raises your price, and every wave " +
             "you lose hands a lane to whoever paid. Do not let the district go cheap.",
      beat: "Auction void. The block stays unowned, and that is the whole victory."
    },
    {
      num: "IV",
      title: "ASH DIVIDEND",
      tag: "THE MECHS STOPPED TAKING ORDERS",
      hook: "The riot mechs turned on their owners, and now they are walking toward the spire.",
      brief: "Nobody is paying them. They are not angry, they are finished, and a finished machine does not " +
             "retreat. Hold the ring with whatever prints fastest and keep the core off the ground.",
      beat: "The last chassis drops. Whatever they were carrying, it was not a shutdown code."
    },
    {
      num: "V",
      title: "LAST BASTION",
      tag: "HOLD UNTIL DAWN",
      hook: "One spire, one night, every lane at once. Dawn is the only reinforcement coming.",
      brief: "This is the wave the whole run was rehearsal for. No new toys, no discounts, no second core. " +
             "Print what you can afford, spend the hero early, and make the night expensive for them.",
      beat: "Sunrise. The spire is still standing and the city is still yours."
    }
  ];

  function actIndexFor(mapIndex) {
    var i = typeof mapIndex === "number" ? mapIndex : 0;
    return ((i % ACTS.length) + ACTS.length) % ACTS.length;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* dashboard card: current act, shown above the operator block */
  function dashCard(mapIndex, mapName) {
    var a = ACTS[actIndexFor(mapIndex)];
    return '<div class="card" style="margin-top:12px;border-color:rgba(255,210,74,.35)">' +
      '<h2 style="color:#ffd24a">ACT ' + a.num + ' · ' + esc(a.title) + '</h2>' +
      '<div class="row" style="margin:0"><div class="m">' +
        '<b style="color:#8ff7e6;font-size:9px;letter-spacing:.12em">' + esc(a.tag) + '</b>' +
        '<span style="display:block;margin-top:5px;line-height:1.5">' + esc(a.hook) + '</span>' +
        '<span style="display:block;margin-top:4px;color:#6f8f97">' + esc(mapName || "") + '</span>' +
      '</div></div></div>';
  }

  /* full-screen act intro, dismissed by tap or after a few seconds */
  function showIntro(mapIndex, mapName) {
    var a = ACTS[actIndexFor(mapIndex)];
    var old = document.getElementById("nw-act");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var wrap = document.createElement("div");
    wrap.id = "nw-act";
    wrap.style.cssText = "position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(3,6,9,.93);padding:22px;opacity:0;transition:opacity .25s";
    wrap.innerHTML =
      '<div style="max-width:360px;width:100%;border:1px solid rgba(56,245,224,.35);border-radius:14px;' +
      'background:linear-gradient(180deg,rgba(10,24,28,.98),rgba(4,10,13,.99));padding:18px;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.7)">' +
        '<div style="font:8px ui-monospace,monospace;letter-spacing:.22em;color:#ffd24a">ACT ' + a.num + '</div>' +
        '<div style="font:700 22px/1.1 ui-monospace,monospace;letter-spacing:.06em;color:#eafcff;margin:6px 0 2px">' +
          esc(a.title) + '</div>' +
        '<div style="font:8px ui-monospace,monospace;letter-spacing:.14em;color:#8ff7e6;margin-bottom:12px">' +
          esc(a.tag) + '</div>' +
        '<div style="font:11px/1.6 ui-monospace,monospace;color:#bcd8dd">' + esc(a.brief) + '</div>' +
        '<div style="margin-top:12px;font:9px ui-monospace,monospace;color:#6f8f97;letter-spacing:.1em">' +
          esc(mapName || "") + '</div>' +
        '<button id="nw-act-go" style="margin-top:16px;width:100%;border:0;border-radius:10px;padding:13px;' +
        'font:11px ui-monospace,monospace;letter-spacing:.16em;color:#03110d;background:linear-gradient(180deg,#6cffbd,#23d386)">' +
        'TAKE THE SPIRE</button>' +
      '</div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(function () { wrap.style.opacity = "1"; });
    function close() {
      wrap.style.opacity = "0";
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 260);
    }
    wrap.addEventListener("click", function (ev) { if (ev.target === wrap) close(); });
    var btn = document.getElementById("nw-act-go");
    if (btn) btn.onclick = close;
    setTimeout(close, 14000);
  }

  /* short beat line, used when a run is won */
  function beatLine(mapIndex) {
    return ACTS[actIndexFor(mapIndex)].beat;
  }

  window.NW_STORY = {
    acts: ACTS,
    actIndexFor: actIndexFor,
    dashCard: dashCard,
    showIntro: showIntro,
    beatLine: beatLine
  };
})();
