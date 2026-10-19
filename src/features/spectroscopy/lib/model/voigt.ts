/**
 * The Voigt function H(a, v): a Gaussian (thermal motion) convolved with a Lorentzian
 * (radiation and collisions), normalised so ∫ H dv = √π. `v` is the distance from line centre
 * in Doppler widths, `a` the Lorentzian half-width in the same units. Computed as the real part
 * of the Faddeeva function by Humlicek's (1982, JQSRT 27, 437) four-region rational
 * approximation, good to about 10⁻⁴ relative everywhere, with no allocation per call.
 */
export function voigt(a: number, v: number) {
  const x = Math.abs(v);
  const y = a;
  const s = x + y;
  /* t = y − i x */
  const tr = y;
  const ti = -x;
  if (s >= 15) {
    /* w = t · 0.5641896 / (0.5 + t²) */
    const dr = 0.5 + tr * tr - ti * ti;
    const di = 2 * tr * ti;
    return realOfQuotient(0.5641896 * tr, 0.5641896 * ti, dr, di);
  }
  if (s >= 5.5) {
    /* w = t (1.410474 + 0.5641896 u) / (0.75 + u (3 + u)), u = t² */
    const ur = tr * tr - ti * ti;
    const ui = 2 * tr * ti;
    const pr = 1.410474 + 0.5641896 * ur;
    const pi = 0.5641896 * ui;
    const nr = tr * pr - ti * pi;
    const ni = tr * pi + ti * pr;
    const qr = 3 + ur;
    const qi = ui;
    const dr = 0.75 + ur * qr - ui * qi;
    const di = ur * qi + ui * qr;
    return realOfQuotient(nr, ni, dr, di);
  }
  if (y >= 0.195 * x - 0.176) {
    let nr = 0.5642236;
    let ni = 0;
    for (const c of [3.778987, 11.96482, 20.20933, 16.4955]) {
      const r = nr * tr - ni * ti + c;
      ni = nr * ti + ni * tr;
      nr = r;
    }
    let dr = 1;
    let di = 0;
    for (const c of [6.699398, 21.69274, 39.27121, 38.82363, 16.4955]) {
      const r = dr * tr - di * ti + c;
      di = dr * ti + di * tr;
      dr = r;
    }
    return realOfQuotient(nr, ni, dr, di);
  }
  /* w = e^u − t P(u) / Q(u) */
  const ur = tr * tr - ti * ti;
  const ui = 2 * tr * ti;
  let pr = 0.56419;
  let pi = 0;
  for (const c of [1.320522, 35.76683, 219.0313, 1540.787, 3321.9905, 36183.31]) {
    const r = c - (ur * pr - ui * pi);
    pi = -(ur * pi + ui * pr);
    pr = r;
  }
  let qr = 1;
  let qi = 0;
  for (const c of [1.841439, 61.57037, 364.2191, 2186.181, 9022.228, 24322.84, 32066.6]) {
    const r = c - (ur * qr - ui * qi);
    qi = -(ur * qi + ui * qr);
    qr = r;
  }
  const nr = tr * pr - ti * pi;
  const ni = tr * pi + ti * pr;
  return Math.exp(ur) * Math.cos(ui) - realOfQuotient(nr, ni, qr, qi);
}

function realOfQuotient(nr: number, ni: number, dr: number, di: number) {
  return (nr * dr + ni * di) / (dr * dr + di * di);
}
