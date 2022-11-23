<template>
  <v-dialog v-model="dialog">
    <template v-slot:activator="{ on, attrs }">
      <v-btn v-bind="attrs" v-on="on">
        <v-icon>mdi-application-export</v-icon>
        EXPORT CSV
      </v-btn>
    </template>
    <v-card>
      <v-card-title> Current Annotation List as CSV </v-card-title>
      <v-card-text>
        <v-textarea
          ref="fieldToCopy"
          v-if="text && text.length"
          v-model="text"
          readonly
          >{{ text }}
          <template v-slot:append>
            <v-btn
              icon
              title="Copy to clipboard"
              @click="copyCSVText"
              :disabled="!canUseClipboard"
              ><v-icon>{{ "mdi-content-copy" }}</v-icon></v-btn
            >
          </template>
        </v-textarea>
        <p v-else>LOADING</p>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="download" :enabled="text && text.length">
          <v-icon> mdi-save </v-icon>
          DOWNLOAD
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn @click="dialog = false" text>Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Vue, Component, Emit, Prop, Watch } from "vue-property-decorator";
import store from "@/store";
import annotationStore from "@/store/annotation";
import propertyStore from "@/store/properties";
import filterStore from "@/store/filters";

import { IAnnotation } from "@/store/model";

@Component({
  components: {}
})
export default class AnnotationCsvDialog extends Vue {
  readonly store = store;
  readonly annotationStore = annotationStore;
  readonly propertyStore = propertyStore;
  readonly filterStore = filterStore;

  get canUseClipboard() {
    return !!navigator || !!(navigator as Navigator)?.clipboard;
  }

  copyCSVText() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.text);
    } else {
      const fieldToCopy = (this.$refs.fieldToCopy as Vue)?.$el?.querySelector(
        "input"
      );
      if (fieldToCopy) {
        fieldToCopy.select();
        document.execCommand("copy");
      }
    }
  }

  dialog: boolean = false;
  text = "";

  @Prop()
  readonly annotations: any;

  @Prop()
  readonly propertyIds: any;

  getPropertyValueForAnnotation(annotation: IAnnotation, propertyId: string) {
    const values = this.propertyStore.propertyValues[annotation.id];
    if (!values) {
      return "-";
    }

    if (!Object.keys(values).includes(propertyId)) {
      return "-";
    }
    return values[propertyId];
  }

  async generateCSVStringForAnnotations() {
    let text = "Id, Layer Id, XY, Z, Time, Tags, Shape";
    this.propertyIds?.forEach((id: string) => {
      text += `, ${id}`;
    });

    (this.annotations as IAnnotation[]).forEach((annotation: IAnnotation) => {
      text += `\n${annotation.id}, ${annotation.layerId}, ${
        annotation.location.XY
      }, ${annotation.location.Z}, ${
        annotation.location.Time
      }, [${annotation.tags.reduce(
        (line: string, tag: string) => `${line} ${tag}`,
        ""
      )} ], ${annotation.shape}`;
      this.propertyIds?.forEach((id: string) => {
        const value = this.getPropertyValueForAnnotation(annotation, id);
        text += `, ${value}`;
      });
    });
    return text;
  }
  @Watch("dialog")
  updateText() {
    if (this.dialog) {
      this.generateCSVStringForAnnotations().then((text: string) => {
        this.text = text;
      });
    } else {
      this.text = "";
    }
  }

  download() {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(this.text)
    );
    element.setAttribute("download", "upenn_annotation_export.csv");

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }
}
</script>
