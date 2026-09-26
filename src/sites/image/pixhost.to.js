/**
 * @domain pixho.st
 * @domain pixhost.cc
 * @domain pixhost.to
 */
_.register({
  rule: {
    host: [/^(www\.)?pixhost\.(cc|to)$/, /^pixho\.st$/],
    path: /^\/show\//,
  },
  async ready() {
    let b = $.$(".age-gate__enter");
    if (b) {
      b.click();
    }
    await _.wait(3000);
    b = $("#image");
    await $.openImage(b.src);
  },
});
