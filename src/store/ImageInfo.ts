import { IGirderItem, RestClientHelper } from "@/girder";

export default class ImageInfo {
  private readonly item: IGirderItem;
  private readonly api: RestClientHelper;

  constructor(item: IGirderItem, api: RestClientHelper) {
    this.item = item;
    this.api = api;
  }
}

// function changeValues() {
//   style.min = $("#min").val();
//   style.max = $("#max").val();
//   let gamma = Math.pow(10, parseFloat($("#gamma").val()) * 0.01);
//   $("#gamma").attr("title", "gamma: " + gamma.toFixed(3));
//   let steps = 17;
//   style.palette = [];
//   for (let i = 0; i < steps; i += 1) {
//     let s = i / (steps - 1),
//       d = s ? Math.pow(s, 1.0 / gamma) : 0,
//       hex = "0" + Math.round(d * 255).toString(16);
//     hex = hex.substring(hex.length - 2);
//     style.palette.push(`#${hex}${hex}${hex}`);
//   }
//   var box = document.getElementById("markbox"),
//     w = box.clientWidth,
//     gammaelem = document.getElementById("gammamark"),
//     minelem = document.getElementById("minmark"),
//     maxelem = document.getElementById("maxmark"),
//     x0 = item.hist[frame][channel].min,
//     x1 = item.hist[frame][channel].max,
//     min =
//       style.min === "auto" || style.min === "min"
//         ? x0
//         : style.min === "max"
//         ? x1
//         : parseFloat(style.min),
//     max =
//       style.max === "auto" || style.max === "max"
//         ? x1
//         : style.max === "min"
//         ? x0
//         : parseFloat(style.max);
//   if (x1 === x0) {
//     x1 = x0 + 1;
//   }
//   var minx = ((min - x0) / (x1 - x0)) * w,
//     maxx = ((max - x0) / (x1 - x0)) * w;
//   minelem.style.left = Math.floor(minx) + "px";
//   maxelem.style.left = Math.floor(maxx - 1) + "px";
//   gammaelem.style.left =
//     Math.floor(minx + Math.pow(0.5, gamma) * (maxx - minx) - 0.5) + "px";
//   updateUrl();
// }

// function changeFrame() {
//   var newframe = parseInt($("#frame").val(), 10),
//     newchannel = parseInt($("#channel").val(), 10);
//   if (frame !== newframe) {
//     frame = newframe;
//     $("#channel").attr("max", item.hist[frame].length - 1);
//     if (newchannel >= item.hist[frame].length || channel < 0) {
//       newchannel = item.hist[frame].length > 2 ? 1 : 0;
//       $("#channel").val(newchannel);
//     }
//   }
//   channel = newchannel;
//   style.band = channel + 1;
//   $("#min").attr("title", item.hist[frame][channel].min);
//   $("#max").attr("title", item.hist[frame][channel].max);

//   var histelem = document.getElementById("histogram");
//   while (histelem.firstChild) {
//     histelem.removeChild(histelem.firstChild);
//   }
//   var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
//   var w = histelem.clientWidth,
//     h = histelem.clientHeight;
//   svg.setAttribute("width", w);
//   svg.setAttribute("height", h);
//   var points = [w, h, 0, h],
//     maxval;
//   item.hist[frame][channel].hist.forEach((y, idx) => {
//     maxval = maxval === undefined || y > maxval ? y : maxval;
//   });
//   var X0 = item.hist[frame][channel].bin_edges[0],
//     X1 =
//       item.hist[frame][channel].bin_edges[
//         item.hist[frame][channel].bin_edges.length - 1
//       ];
//   if (X1 == X0) {
//     X1 = X0 + 1;
//   }
//   item.hist[frame][channel].hist.forEach((y, idx) => {
//     var x0 = item.hist[frame][channel].bin_edges[idx],
//       x1 = item.hist[frame][channel].bin_edges[idx + 1];
//     points.push(((x0 - X0) * w) / (X1 - X0));
//     points.push(h - (h * y) / maxval);
//     points.push(((x1 - X0) * w) / (X1 - X0));
//     points.push(h - (h * y) / maxval);
//   });
//   var polygon = document.createElementNS(
//     "http://www.w3.org/2000/svg",
//     "polygon"
//   );
//   polygon.setAttribute("points", points.join(" "));
//   polygon.setAttribute("style", "fill:#0000ff80");
//   svg.appendChild(polygon);
//   histelem.appendChild(svg);

//   updateUrl();
//   changeValues();
// }
