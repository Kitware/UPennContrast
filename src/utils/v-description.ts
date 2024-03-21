import { Vue } from "vue-property-decorator";
import { reactive } from "vue";

export interface IFeatureDescription {
  section: string;
  title: string;
  description: string;
}

let counter = 0;
export const descriptions: { [id: string]: IFeatureDescription } = reactive({});

function bind(el: any, value: IFeatureDescription) {
  let id: number;
  if ("featureDescriptionId" in el) {
    id = el.featureDescriptionId;
  } else {
    id = counter++;
    el.featureDescriptionId = id;
  }
  el.featureDescription = value;
  Vue.set(descriptions, id, value);
}

function unbind(el: any) {
  const id: number = el.featureDescriptionId;
  Vue.delete(descriptions, id);
}

export default function install(Vue: any) {
  Vue.directive("description", {
    inserted(el: any, { value }: { value: IFeatureDescription }) {
      bind(el, value);
    },
    update(el: any, { value }: { value: IFeatureDescription }) {
      unbind(el);
      bind(el, value);
    },
    unbind(el: any) {
      unbind(el);
    },
  });
}
