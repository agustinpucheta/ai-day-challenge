<script setup lang="ts">
import { computed } from 'vue';
import { es } from '@/i18n/es';
import { storyPointsDeviation } from '@/issues/format';

/**
 * Story points as two labelled fields, planned beside final. A missing number says
 * "Sin estimar"; it is never drawn as 0. The deviation hint only appears when asked for and
 * only when both numbers exist and differ.
 */
const props = withDefaults(
  defineProps<{
    planned: number | null;
    final: number | null;
    size?: 'sm' | 'lg';
    finalLabel?: string;
    showDeviation?: boolean;
  }>(),
  { size: 'sm', finalLabel: es.storyPoints.final, showDeviation: false },
);

const deviation = computed(() =>
  props.showDeviation ? storyPointsDeviation(props.final, props.planned) : null,
);
</script>

<template>
  <dl :class="['sp-fields', `sp-fields--${size}`]" :aria-label="es.common.storyPoints">
    <div class="sp-field" data-testid="sp-planned">
      <dt class="sp-field__label">{{ es.storyPoints.planned }}</dt>
      <dd class="sp-field__value">
        <strong v-if="planned !== null">{{ planned }}</strong>
        <span v-else class="sp-field__none">{{ es.storyPoints.notEstimated }}</span>
      </dd>
    </div>
    <div class="sp-field" data-testid="sp-final">
      <dt class="sp-field__label">{{ finalLabel }}</dt>
      <dd class="sp-field__value">
        <strong v-if="final !== null">{{ final }}</strong>
        <span v-else class="sp-field__none">{{ es.storyPoints.notEstimated }}</span>
        <span v-if="deviation" class="badge badge--warning">{{ deviation }}</span>
      </dd>
    </div>
  </dl>
</template>
