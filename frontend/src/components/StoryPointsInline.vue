<script setup lang="ts">
import { computed } from 'vue';
import { storyPointsDeviation } from '@/issues/format';

/**
 * Story points as two labelled fields, planned beside final. A missing number says
 * "Not estimated"; it is never drawn as 0. The deviation hint only appears when asked for and
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
  { size: 'sm', finalLabel: 'Final', showDeviation: false },
);

const deviation = computed(() =>
  props.showDeviation ? storyPointsDeviation(props.final, props.planned) : null,
);
</script>

<template>
  <dl :class="['sp-fields', `sp-fields--${size}`]" aria-label="Story points">
    <div class="sp-field" data-testid="sp-planned">
      <dt class="sp-field__label">Planned</dt>
      <dd class="sp-field__value">
        <strong v-if="planned !== null">{{ planned }}</strong>
        <span v-else class="sp-field__none">Not estimated</span>
      </dd>
    </div>
    <div class="sp-field" data-testid="sp-final">
      <dt class="sp-field__label">{{ finalLabel }}</dt>
      <dd class="sp-field__value">
        <strong v-if="final !== null">{{ final }}</strong>
        <span v-else class="sp-field__none">Not estimated</span>
        <span v-if="deviation" class="badge badge--warning">{{ deviation }}</span>
      </dd>
    </div>
  </dl>
</template>
