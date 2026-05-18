export class QuasarProvider extends HTMLElement {
  connectedCallback() {
    this.endpoint = this.getAttribute("endpoint") ?? "/api/query";
  }

  async query(metric) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metric }),
    });

    if (!response.ok) {
      throw new Error(`Query failed with ${response.status}`);
    }

    return response.json();
  }
}

customElements.define("quasar-provider", QuasarProvider);
