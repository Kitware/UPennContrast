export function downloadToClient(params: { [attribute: string]: any }): void {
  const element = document.createElement("a");

  for (const [attribute, value] of Object.entries(params)) {
    element.setAttribute(attribute, value);
  }

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}
