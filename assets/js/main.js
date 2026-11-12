/* Àtics Restaurant · comportamiento de la web (sin dependencias).
   Horario y avisos según la hora de Lloret (Europe/Madrid). Para probar: ?fecha=2026-11-26&hora=13:30 */
(function () {
  "use strict";
  var raiz = document.documentElement;
  var datosEl = document.getElementById("datos-atics");
  if (!datosEl) return;
  var D = JSON.parse(datosEl.textContent);
  var X = D.textos;
  var reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var captura = raiz.classList.contains("captura");
  var animar = !reducir && !captura;
  var suave = reducir ? "auto" : "smooth";
  var lista = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  /* ---------- fecha y hora de Lloret ---------- */
  function ahoraLloret() {
    var q = new URLSearchParams(location.search);
    var p = {};
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    var fecha = q.get("fecha") || (p.year + "-" + p.month + "-" + p.day);
    var hora = q.get("hora") || ((p.hour === "24" ? "00" : p.hour) + ":" + p.minute);
    return { fecha: fecha, min: aMin(hora), dia: diaSemana(fecha) };
  }
  function aMin(h) { var a = h.split(":"); return (+a[0]) * 60 + (+a[1] || 0); }
  function diaSemana(iso) { var d = new Date(iso + "T12:00:00Z").getUTCDay(); return d === 0 ? 7 : d; } // 1 lunes ... 7 domingo
  function sumarDias(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function fmt(iso, op) { return new Intl.DateTimeFormat(D.locale, Object.assign({ timeZone: "UTC" }, op)).format(new Date(iso + "T12:00:00Z")); }
  function nombreDia(iso) { return fmt(iso, { weekday: "long" }); }
  function diaYMes(iso) { return fmt(iso, { day: "numeric", month: "long" }); }
  function diaYNombre(iso) { return nombreDia(iso) + " " + fmt(iso, { day: "numeric" }); }
  function hora(hhmm) {
    var a = hhmm.split(":"), h = +a[0], m = +a[1];
    if (D.lang === "en") { var h12 = h % 12 || 12; return h12 + (m ? ":" + a[1] : "") + (h < 12 ? " am" : " pm"); }
    if (D.lang === "fr") return h + " h" + (m ? " " + a[1] : "");
    return hhmm;
  }
  function rellenar(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }

  var H = D.horario;
  function cierreEn(iso) { for (var i = 0; i < D.cierres.length; i++) { var c = D.cierres[i]; if (iso >= c.desde && iso <= c.hasta) return c; } return null; }
  function proximoCierre(iso) { for (var i = 0; i < D.cierres.length; i++) { var c = D.cierres[i]; if (iso >= (c.anunciar || c.desde) && iso < c.desde) return c; } return null; }
  function servicios(iso) {
    if (cierreEn(iso)) return [];
    var d = diaSemana(iso), s = [];
    if (H.mediodia.dias.indexOf(d) > -1) s.push({ tipo: "mediodia", desde: H.mediodia.desde, hasta: H.mediodia.hasta });
    if (H.noche.dias.indexOf(d) > -1) s.push({ tipo: "noche", desde: H.noche.desde, hasta: H.noche.hasta });
    return s;
  }
  function proximaApertura(iso, min) {
    for (var n = 0; n < 60; n++) {
      var dia = sumarDias(iso, n), s = servicios(dia);
      for (var i = 0; i < s.length; i++) if (n > 0 || aMin(s[i].desde) > min) return { fecha: dia, dias: n, desde: s[i].desde };
    }
    return null;
  }

  var hoy = ahoraLloret();
  var cierre = cierreEn(hoy.fecha);
  var aviso = proximoCierre(hoy.fecha);

  /* ---------- aviso de vacaciones (caduca solo) ---------- */
  var avisoEl = document.querySelector("[data-aviso]");
  var textoAviso = "";
  if (cierre) {
    var vuelta = proximaApertura(cierre.hasta, 24 * 60);
    textoAviso = rellenar(X.aviso.durante, { hasta: diaYMes(cierre.hasta), vuelta: vuelta ? diaYNombre(vuelta.fecha) : "" });
  } else if (aviso) {
    var mismoMes = aviso.desde.slice(0, 7) === aviso.hasta.slice(0, 7);
    textoAviso = rellenar(X.aviso.antes, { desde: mismoMes ? fmt(aviso.desde, { day: "numeric" }) : diaYMes(aviso.desde), hasta: diaYMes(aviso.hasta) });
  }
  if (avisoEl) {
    if (textoAviso) avisoEl.querySelector("[data-aviso-texto]").textContent = textoAviso;
    avisoEl.hidden = !textoAviso;
    raiz.classList.toggle("con-aviso", !!textoAviso);
    // la portada ocupa la pantalla menos lo que mida el aviso
    var medirAviso = function () { if (textoAviso) raiz.style.setProperty("--aviso", avisoEl.offsetHeight + "px"); else raiz.style.removeProperty("--aviso"); };
    medirAviso();
    if ("ResizeObserver" in window) new ResizeObserver(medirAviso).observe(avisoEl);
  }

  /* ---------- estado de hoy en la portada ---------- */
  var estadoEl = document.querySelector("[data-estado]");
  if (estadoEl) {
    var frase = "", abierto = false;
    if (cierre) {
      var v = proximaApertura(cierre.hasta, 24 * 60);
      frase = rellenar(X.estado.vacaciones, { vuelta: v ? diaYNombre(v.fecha) : "" });
    } else {
      var s = servicios(hoy.fecha), actual = null;
      s.forEach(function (x) { if (hoy.min >= aMin(x.desde) && hoy.min < aMin(x.hasta)) actual = x; });
      if (actual) { frase = rellenar(X.estado.abierto, { h: hora(actual.hasta) }); abierto = true; }
      else {
        var p = proximaApertura(hoy.fecha, hoy.min);
        if (p && p.dias === 0) frase = rellenar(X.estado.abreHoy, { h: hora(p.desde) });
        else if (p && p.dias === 1) frase = rellenar(X.estado.abreManana, { h: hora(p.desde) });
        else if (p) frase = rellenar(X.estado.abreDia, { dia: p.dias > 6 ? diaYNombre(p.fecha) : nombreDia(p.fecha), h: hora(p.desde) });
      }
    }
    if (frase) { estadoEl.textContent = frase; estadoEl.classList.toggle("abierto", abierto); }
  }

  /* ---------- tabla de horario: hoy y ahora ---------- */
  var fila = document.querySelector('.horario tr[data-dia="' + hoy.dia + '"]');
  if (fila && !cierre) {
    fila.classList.add("hoy");
    var marca = document.createElement("span");
    marca.className = "marca-hoy"; marca.textContent = X.hoy;
    fila.querySelector("th").appendChild(marca);
    var celdas = fila.querySelectorAll("td");
    servicios(hoy.fecha).forEach(function (x) {
      if (hoy.min >= aMin(x.desde) && hoy.min < aMin(x.hasta)) {
        var td = x.tipo === "mediodia" ? celdas[0] : celdas[1];
        if (td) { td.classList.add("ahora"); td.setAttribute("aria-label", td.textContent + ", " + X.ahora); }
      }
    });
  }
  var avisoHorario = document.querySelector("[data-aviso-horario]");
  if (avisoHorario && textoAviso) { avisoHorario.textContent = textoAviso; avisoHorario.hidden = false; }

  /* ---------- contenidos con fecha: temporada y menús ---------- */
  lista(".carta__panel[data-hasta]").forEach(function (el) { if (hoy.fecha > el.getAttribute("data-hasta")) el.remove(); });
  lista(".menu[data-hasta]").forEach(function (el) {
    if (hoy.fecha > el.getAttribute("data-hasta")) { var n = el.querySelector("[data-menu-caducado]"); if (n) n.hidden = false; }
  });

  /* ---------- pestañas de la carta ---------- */
  var cuerpo = document.querySelector("[data-pestanas]");
  var pestanas = [];
  function seleccionar(i, foco) {
    pestanas.forEach(function (b, j) {
      var activa = i === j;
      b.setAttribute("aria-selected", activa ? "true" : "false");
      b.tabIndex = activa ? 0 : -1;
      var panel = document.getElementById(b.getAttribute("aria-controls"));
      panel.hidden = !activa;
      if (activa && animar) { panel.classList.remove("entra"); void panel.offsetWidth; panel.classList.add("entra"); }
    });
    if (foco) pestanas[i].focus();
    var b = pestanas[i], barra = b.parentNode;
    if (barra.scrollWidth > barra.clientWidth) barra.scrollTo({ left: b.offsetLeft - barra.clientWidth / 2 + b.offsetWidth / 2, behavior: suave });
  }
  if (cuerpo) {
    var paneles = lista(".carta__panel", cuerpo);
    var tablist = document.createElement("div");
    tablist.className = "pestanas";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", cuerpo.getAttribute("data-etiqueta") || "");
    paneles.forEach(function (panel, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "pestana";
      b.id = "pestana-" + panel.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", panel.id);
      b.textContent = panel.querySelector(".carta__titulo").textContent;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", b.id);
      panel.tabIndex = 0;
      b.addEventListener("click", function () {
        seleccionar(i, false);
        if (cuerpo.getBoundingClientRect().top < 0) cuerpo.scrollIntoView({ behavior: suave });
      });
      b.addEventListener("keydown", function (e) {
        var k = e.key, n = pestanas.length, j = null;
        if (k === "ArrowRight") j = (i + 1) % n; else if (k === "ArrowLeft") j = (i - 1 + n) % n; else if (k === "Home") j = 0; else if (k === "End") j = n - 1;
        if (j !== null) { e.preventDefault(); seleccionar(j, true); }
      });
      pestanas.push(b);
      tablist.appendChild(b);
    });
    cuerpo.insertBefore(tablist, cuerpo.firstChild);
    cuerpo.classList.add("con-pestanas");
    var inicial = 0;
    var porHash = location.hash && document.getElementById(location.hash.slice(1));
    if (porHash && porHash.classList.contains("carta__panel")) inicial = Math.max(0, paneles.indexOf(porHash));
    seleccionar(inicial, false);
    lista("[data-ir-pestana]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var destino = document.getElementById("carta-" + a.getAttribute("data-ir-pestana"));
        var i = paneles.indexOf(destino);
        if (i < 0) return;
        e.preventDefault();
        seleccionar(i, false);
        document.getElementById("carta").scrollIntoView({ behavior: suave });
        history.replaceState(null, "", "#carta-" + a.getAttribute("data-ir-pestana"));
      });
    });
  }

  /* ---------- revelados al entrar en pantalla ---------- */
  var revelar = lista("[data-titulo], [data-subir], [data-revelar], [data-carrusel], .plano");
  if ("IntersectionObserver" in window && animar) {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("visto"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revelar.forEach(function (el) { io.observe(el); });
  } else revelar.forEach(function (el) { el.classList.add("visto"); });
  if (captura) lista('img[loading="lazy"]').forEach(function (img) { img.loading = "eager"; });

  /* ---------- cabecera: transparente sobre la portada, sólida al bajar ---------- */
  var cab = document.querySelector("[data-cabecera]");
  if (cab && "IntersectionObserver" in window) {
    var testigo = document.createElement("div");
    testigo.setAttribute("aria-hidden", "true");
    testigo.style.cssText = "position:absolute;top:0;left:0;width:1px;height:64px;pointer-events:none";
    document.body.prepend(testigo);
    new IntersectionObserver(function (e) { cab.classList.toggle("solida", !e[0].isIntersecting); }).observe(testigo);
  } else if (cab) cab.classList.add("solida");

  /* ---------- carrusel de platos: flechas, avance y arrastre con ratón ---------- */
  lista("[data-carrusel]").forEach(function (car) {
    var pista = car.querySelector(".carrusel__pista");
    var control = car.parentNode.querySelector("[data-carrusel-control]");
    if (!pista || !control) return;
    var ant = control.querySelector("[data-carrusel-ant]"), sig = control.querySelector("[data-carrusel-sig]");
    var barra = control.querySelector(".carrusel__avance i");
    control.hidden = false;
    var paso = function () {
      var it = pista.querySelector(".carrusel__item");
      var hueco = parseFloat(getComputedStyle(pista).columnGap) || 0;
      return it ? it.getBoundingClientRect().width + hueco : pista.clientWidth * 0.8;
    };
    var actualizar = function () {
      var max = pista.scrollWidth - pista.clientWidth;
      ant.setAttribute("aria-disabled", pista.scrollLeft < 10 ? "true" : "false");
      sig.setAttribute("aria-disabled", pista.scrollLeft > max - 10 ? "true" : "false");
      barra.style.width = Math.min(100, pista.clientWidth / pista.scrollWidth * 100) + "%";
      barra.style.transform = "translateX(" + (pista.scrollLeft / pista.clientWidth * 100) + "%)";
    };
    var mover = function (dir) {
      var p = paso(), n = Math.max(1, Math.round(pista.clientWidth / p) - 1);
      pista.scrollTo({ left: (Math.round(pista.scrollLeft / p) + dir * n) * p, behavior: suave });
    };
    ant.addEventListener("click", function () { if (ant.getAttribute("aria-disabled") !== "true") mover(-1); });
    sig.addEventListener("click", function () { if (sig.getAttribute("aria-disabled") !== "true") mover(1); });
    var pendiente = false;
    pista.addEventListener("scroll", function () { if (!pendiente) { pendiente = true; requestAnimationFrame(function () { pendiente = false; actualizar(); }); } }, { passive: true });
    window.addEventListener("resize", actualizar);
    actualizar();
    // arrastrar con el ratón (en táctil ya se desliza solo)
    var arr = null;
    pista.addEventListener("dragstart", function (e) { e.preventDefault(); });
    pista.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse" && e.button === 0) arr = { x: e.clientX, s: pista.scrollLeft, movido: false, id: e.pointerId }; });
    pista.addEventListener("pointermove", function (e) {
      if (!arr) return;
      var dx = e.clientX - arr.x;
      if (!arr.movido && Math.abs(dx) > 5) { arr.movido = true; pista.classList.add("arrastrando"); pista.setPointerCapture(arr.id); }
      if (arr.movido) { pista.scrollLeft = arr.s - dx; arr.dx = dx; }
    });
    var soltar = function () {
      if (!arr) return;
      var movido = arr.movido, dx = arr.dx || 0; arr = null;
      if (!movido) return;
      // basta un gesto corto para pasar a la tarjeta siguiente o anterior
      var p = paso(), pos = pista.scrollLeft / p;
      var destino = (Math.abs(dx) > 40 ? (dx < 0 ? Math.ceil(pos) : Math.floor(pos)) : Math.round(pos)) * p;
      pista.classList.remove("arrastrando");
      pista.scrollTo({ left: destino, behavior: suave });
    };
    pista.addEventListener("pointerup", soltar);
    pista.addEventListener("pointercancel", soltar);
  });

  /* ---------- espacios: varias fotos por tarjeta ---------- */
  var secEsp = document.querySelector(".espacios");
  var flechaAnt = document.querySelector("[data-carrusel-ant] svg"), flechaSig = document.querySelector("[data-carrusel-sig] svg");
  lista("[data-mini-carrusel]").forEach(function (caja) {
    var pista = caja.querySelector(".espacio__pista");
    var puntos = lista(".espacio__puntos i", caja);
    var n = pista.children.length;
    var nombre = pista.getAttribute("aria-label");
    var indice = function () { return Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth)); };
    var crear = function (clase, texto, icono, dir) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "espacio__flecha espacio__flecha--" + clase;
      b.setAttribute("aria-label", nombre + ": " + texto);
      if (icono) b.appendChild(icono.cloneNode(true));
      b.addEventListener("click", function () {
        var i = Math.min(n - 1, Math.max(0, indice() + dir));
        pista.scrollTo({ left: i * pista.clientWidth, behavior: suave });
      });
      caja.appendChild(b);
      return b;
    };
    var bAnt = crear("ant", secEsp ? secEsp.getAttribute("data-ant") : "", flechaAnt, -1);
    var bSig = crear("sig", secEsp ? secEsp.getAttribute("data-sig") : "", flechaSig, 1);
    var marcarPunto = function () {
      var i = indice();
      puntos.forEach(function (p, j) { p.classList.toggle("activo", j === i); });
      bAnt.setAttribute("aria-disabled", i <= 0 ? "true" : "false");
      bSig.setAttribute("aria-disabled", i >= n - 1 ? "true" : "false");
    };
    pista.addEventListener("scroll", function () { requestAnimationFrame(marcarPunto); }, { passive: true });
    marcarPunto();
  });

  /* ---------- índice en móvil ---------- */
  var indice = document.querySelector("[data-indice]");
  var abrir = document.querySelector("[data-abrir-indice]");
  var cerrar = document.querySelector("[data-cerrar-indice]");
  function enfocables() { return lista("a[href], button", indice).filter(function (el) { return el.offsetParent !== null; }); }
  function abrirIndice() {
    indice.hidden = false; indice.classList.add("abierto");
    abrir.setAttribute("aria-expanded", "true");
    raiz.style.overflow = "hidden";
    var f = enfocables(); if (f[1]) f[1].focus();
    document.addEventListener("keydown", teclasIndice);
  }
  function cerrarIndice(devolverFoco) {
    indice.hidden = true; indice.classList.remove("abierto");
    abrir.setAttribute("aria-expanded", "false");
    raiz.style.overflow = "";
    document.removeEventListener("keydown", teclasIndice);
    if (devolverFoco !== false) abrir.focus();
  }
  function teclasIndice(e) {
    if (e.key === "Escape") { cerrarIndice(); return; }
    if (e.key !== "Tab") return;
    var f = enfocables(), primero = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }
  if (indice && abrir) {
    abrir.addEventListener("click", abrirIndice);
    if (cerrar) cerrar.addEventListener("click", function () { cerrarIndice(); });
    lista(".indice__nav a", indice).forEach(function (a) { a.addEventListener("click", function () { cerrarIndice(false); }); });
    window.matchMedia("(min-width: 1180px)").addEventListener("change", function (m) { if (m.matches && !indice.hidden) cerrarIndice(false); });
  }

  /* ---------- plano: en móvil, encuadre cuadrado y más cerca del restaurante ---------- */
  var planoSvg = document.querySelector(".plano-svg");
  if (planoSvg) {
    var vbAncho = planoSvg.getAttribute("viewBox");
    var mq = window.matchMedia("(max-width: 699px)");
    var ajustar = function () { planoSvg.setAttribute("viewBox", mq.matches ? "300 70 680 680" : vbAncho); };
    ajustar(); mq.addEventListener("change", ajustar);
  }

  /* ---------- cambiar de idioma sin perder la sección ---------- */
  lista("[data-idioma]").forEach(function (a) {
    a.addEventListener("click", function () { if (location.hash && a.getAttribute("aria-current") !== "page") a.href = a.href.split("#")[0] + location.hash; });
  });
})();
