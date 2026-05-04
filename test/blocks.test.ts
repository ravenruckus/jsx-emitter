import { describe, expect, it } from 'vitest';
import { blockToReact } from '../src/blocks';
import { createSingleBinding } from '../src/internal/bindings';
import { createNode } from '../src/internal/create-node';
import type { Binding, JsonComponent, JsonNode, ToReactOptions } from '../src/types';

const opts = (overrides: Partial<ToReactOptions> = {}): ToReactOptions => ({
  stylesType: 'styled-jsx',
  stateType: 'useState',
  type: 'dom',
  ...overrides,
});

const node = (overrides: Partial<JsonNode> = {}): JsonNode => createNode({ ...overrides });

const expr = (code: string): Binding => createSingleBinding({ code });

const component = (overrides: Partial<JsonComponent> = {}): JsonComponent => ({
  '@type': 'jsx-emitter/component',
  name: 'C',
  imports: [],
  meta: {},
  inputs: [],
  state: {},
  context: { get: {}, set: {} },
  refs: {},
  hooks: { onMount: [], onEvent: [] },
  children: [],
  subComponents: [],
  ...overrides,
});

const collapseWs = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('blockToReact — text leaves', () => {
  it('emits a plain string for a text-property node on dom', () => {
    const n = node({ name: 'span', properties: { _text: 'hello' } });
    expect(blockToReact(n, opts(), component(), false)).toBe('hello');
  });

  it('wraps non-empty text in <Text> when type is native', () => {
    const n = node({ name: 'span', properties: { _text: 'hi' } });
    expect(blockToReact(n, opts({ type: 'native' }), component(), false)).toBe('<Text>hi</Text>');
  });

  it('passes through whitespace-only text on native (does not wrap)', () => {
    const n = node({ name: 'span', properties: { _text: '   ' } });
    expect(blockToReact(n, opts({ type: 'native' }), component(), false)).toBe('   ');
  });

  it('emits {expr} for a text-binding node on dom', () => {
    const n = node({ name: 'span', bindings: { _text: expr('foo') } });
    expect(blockToReact(n, opts(), component(), false)).toBe('{foo}');
  });

  it('wraps non-children, non-slot text bindings in <Text> on native', () => {
    const n = node({ name: 'span', bindings: { _text: expr('foo') } });
    expect(blockToReact(n, opts({ type: 'native' }), component(), false)).toBe('<Text>{foo}</Text>');
  });

  it('strips state. prefix from a text binding via processBinding', () => {
    const n = node({ name: 'span', bindings: { _text: expr('state.foo') } });
    expect(blockToReact(n, opts({ stateType: 'useState' }), component(), false)).toBe('{foo}');
  });
});

describe('blockToReact — element shape', () => {
  it('self-closes void HTML tags like img', () => {
    const n = node({ name: 'img' });
    expect(collapseWs(blockToReact(n, opts(), component(), false))).toBe('<img />');
  });

  it('self-closes any element with no children', () => {
    const n = node({ name: 'div' });
    expect(collapseWs(blockToReact(n, opts(), component(), false))).toBe('<div />');
  });

  it('emits an open + close pair when there are children', () => {
    const n = node({ name: 'div', children: [node({ properties: { _text: 'x' } })] });
    expect(collapseWs(blockToReact(n, opts(), component(), false))).toBe('<div>x</div>');
  });

  it('emits string properties as JSX attributes', () => {
    const n = node({ name: 'a', properties: { id: 'top' } });
    expect(collapseWs(blockToReact(n, opts(), component(), false))).toBe('<a id="top" />');
  });

  it('rewrites class property to className (string form)', () => {
    const n = node({ name: 'div', properties: { class: 'a b' } });
    expect(collapseWs(blockToReact(n, opts(), component(), false))).toBe('<div className="a b" />');
  });

  it('rewrites class binding to className expression', () => {
    const n = node({ name: 'div', bindings: { class: expr('cls') } });
    expect(collapseWs(blockToReact(n, opts(), component(), false))).toBe(
      '<div className={cls} />',
    );
  });

  it('drops invalid attribute names', () => {
    const n = node({ name: 'div', properties: { '!bad': 'oops' } });
    expect(collapseWs(blockToReact(n, opts(), component(), false))).toBe('<div />');
  });

  it('omits an empty-object css binding', () => {
    const n = node({ name: 'div', bindings: { css: expr('{}') } });
    expect(collapseWs(blockToReact(n, opts(), component(), false))).toBe('<div />');
  });
});

describe('blockToReact — attribute mappers', () => {
  it('maps spellcheck → spellCheck and for → htmlFor', () => {
    const n = node({ name: 'label', properties: { for: 'x', spellcheck: 'true' } });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('htmlFor="x"');
    expect(out).toContain('spellCheck="true"');
  });

  it('maps innerHTML to dangerouslySetInnerHTML', () => {
    const n = node({ name: 'div', bindings: { innerHTML: expr('"<b>x</b>"') } });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('dangerouslySetInnerHTML={{__html: "<b>x</b>"}}');
  });

  it('rewrites a ref binding that points at a prop to the bare prop name', () => {
    const n = node({
      name: 'input',
      bindings: { ref: expr('props.elementRef') },
    });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('ref={elementRef}');
  });

  it('keeps the ref value verbatim when it does not match the props pattern', () => {
    const n = node({ name: 'input', bindings: { ref: expr('localRef') } });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('ref={localRef}');
  });
});

describe('blockToReact — events', () => {
  it('wraps an onClick binding in an arrow function', () => {
    const n = node({ name: 'button', bindings: { onClick: expr('doThing()') } });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('onClick={(event) => doThing() }');
  });

  it('uses async wrapper when binding is async', () => {
    const n = node({
      name: 'button',
      bindings: {
        onClick: { code: 'await doThing()', type: 'single', bindingType: 'expression', async: true },
      },
    });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('onClick={async (event) => await doThing() }');
  });

  it('uses custom argument names when supplied', () => {
    const n = node({
      name: 'input',
      bindings: {
        onChange: {
          code: 'set(e)',
          type: 'single',
          bindingType: 'expression',
          arguments: ['e'],
        },
      },
    });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('onChange={(e) => set(e) }');
  });

  it('maps onClick → onPress on native', () => {
    const n = node({ name: 'Pressable', bindings: { onClick: expr('go()') } });
    const out = collapseWs(blockToReact(n, opts({ type: 'native' }), component(), false));
    expect(out).toContain('onPress={(event) => go() }');
  });
});

describe('blockToReact — bindings shapes', () => {
  it('emits spread bindings as {...(expr)}', () => {
    const n = node({
      name: 'div',
      bindings: {
        rest: { code: 'props.rest', type: 'spread', spreadType: 'normal' },
      },
    });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('{...(props.rest)}');
  });

  it('emits boolean-true bindings on unknown attributes as bare attrs', () => {
    const n = node({ name: 'input', bindings: { disabled: expr('true') } });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('<input disabled />');
  });

  it('passes slot* bindings through unchanged', () => {
    const n = node({ name: 'Comp', bindings: { slotHeader: expr('<H />') } });
    const out = collapseWs(blockToReact(n, opts(), component(), false));
    expect(out).toContain('slotHeader={<H />}');
  });

  it('skips a binding when its key also exists in slots', () => {
    const n = node({
      name: 'Comp',
      bindings: { header: expr('<X />') },
      slots: { header: [node({ name: 'H' })] },
    });
    const out = blockToReact(n, opts(), component(), false);
    expect(out).not.toContain('header={<X />}');
    expect(collapseWs(out)).toContain('header={<H />}');
  });
});

describe('blockToReact — react-native attribute quirks', () => {
  it('rewrites Image string src as require() for non-URLs', () => {
    const n = node({ name: 'Image', properties: { src: './foo.png' } });
    const out = collapseWs(blockToReact(n, opts({ type: 'native' }), component(), false));
    expect(out).toContain("source={require('./foo.png')}");
  });

  it('rewrites Image string src as { uri } for absolute URLs', () => {
    const n = node({ name: 'Image', properties: { src: 'https://x.test/a.png' } });
    const out = collapseWs(blockToReact(n, opts({ type: 'native' }), component(), false));
    expect(out).toContain("source={{ uri: 'https://x.test/a.png' }}");
  });

  it('rewrites Image binding src to source={{ uri: ... }}', () => {
    const n = node({ name: 'Image', bindings: { src: expr('imgUrl') } });
    const out = collapseWs(blockToReact(n, opts({ type: 'native' }), component(), false));
    expect(out).toContain('source={{ uri: imgUrl }}');
  });

  it('rewrites TouchableOpacity href binding to onPress with Linking', () => {
    const n = node({ name: 'TouchableOpacity', bindings: { href: expr('"https://x.test"') } });
    const out = collapseWs(blockToReact(n, opts({ type: 'native' }), component(), false));
    expect(out).toContain('onPress={() => Linking.openURL("https://x.test")}');
  });

  it('drops TouchableOpacity target attribute on native', () => {
    const n = node({ name: 'TouchableOpacity', properties: { target: '_blank' } });
    const out = collapseWs(blockToReact(n, opts({ type: 'native' }), component(), false));
    expect(out).not.toContain('target');
  });

  it('rewrites style binding on native ScrollView to contentContainerStyle', () => {
    const n = node({ name: 'ScrollView', bindings: { style: expr('s') } });
    const out = collapseWs(blockToReact(n, opts({ type: 'native' }), component(), false));
    expect(out).toContain('contentContainerStyle={s}');
  });
});

describe('blockToReact — slots', () => {
  it('emits a Slot node by deferring to props.children when no name is bound', () => {
    const n = node({ name: 'Slot' });
    const out = blockToReact(n, opts(), component(), false);
    expect(out).toContain('props.children');
  });

  it('renders parent-level slot bindings as JSX attributes after children', () => {
    const inner = node({ name: 'Slot', bindings: { header: expr('<H />') } });
    const wrapper = node({ name: 'Comp', children: [inner] });
    const out = blockToReact(wrapper, opts(), component(), false);
    expect(out).toContain('header={<H />}');
  });

  it('emits explicit slot prop access prefixed with props.', () => {
    const n = node({ name: 'Slot', properties: { name: 'Header' } });
    const out = blockToReact(n, opts(), component(), false);
    expect(out).toContain('props.Header');
  });

  it('renders a single slot child as bare JSX, multiple wrapped in a fragment', () => {
    const single = node({ name: 'Comp', slots: { header: [node({ name: 'H' })] } });
    expect(collapseWs(blockToReact(single, opts(), component(), false))).toContain(
      'header={<H />}',
    );

    const multi = node({
      name: 'Comp',
      slots: { header: [node({ name: 'H' }), node({ name: 'X' })] },
    });
    const out = collapseWs(blockToReact(multi, opts(), component(), false));
    expect(out).toContain('header={<><H /> <X /></>}');
  });
});

describe('blockToReact — control flow nodes', () => {
  it('emits a Show with a single child without a fragment wrapper', () => {
    const show = node({
      name: 'Show',
      bindings: { when: expr('cond') },
      children: [node({ name: 'span', properties: { _text: 'yes' } })],
    });
    const out = collapseWs(blockToReact(show, opts(), component({ children: [show] }), false));
    expect(out).toContain('cond ? (');
    expect(out).toContain(': null');
  });

  it('wraps Show child in a fragment when there are multiple children', () => {
    const show = node({
      name: 'Show',
      bindings: { when: expr('cond') },
      children: [node({ name: 'a' }), node({ name: 'b' })],
    });
    const out = blockToReact(show, opts(), component({ children: [show] }), false);
    expect(out).toMatch(/<>\s*<a\s*\/>/);
    expect(out).toMatch(/<b\s*\/>\s*<\/>/);
  });

  it('emits Show.else branch when meta.else is present', () => {
    const elseNode = node({ name: 'em', properties: { _text: 'no' } });
    const show = node({
      name: 'Show',
      bindings: { when: expr('cond') },
      children: [node({ name: 'span' })],
      meta: { else: elseNode },
    });
    const out = blockToReact(show, opts(), component({ children: [show] }), false);
    expect(out).toContain('no');
  });

  it('wraps the entire Show in {} when emitted inside JSX', () => {
    const show = node({
      name: 'Show',
      bindings: { when: expr('cond') },
      children: [node({ name: 'a' })],
    });
    const out = blockToReact(show, opts(), component({ children: [show] }), true);
    expect(out.startsWith('{')).toBe(true);
    expect(out.endsWith('}')).toBe(true);
  });

  it('emits a For as a .map call', () => {
    const forNode = node({
      name: 'For',
      bindings: { each: expr('items') },
      scope: {
        forName: 'item',
        indexName: undefined,
        collectionName: undefined,
      },
      children: [node({ name: 'li' })],
    });
    const out = blockToReact(forNode, opts(), component(), false);
    expect(out).toContain('items?.map((item) =>');
  });

  it('wraps For in {} when emitted inside JSX', () => {
    const forNode = node({
      name: 'For',
      bindings: { each: expr('items') },
      scope: {
        forName: 'item',
        indexName: undefined,
        collectionName: undefined,
      },
      children: [node({ name: 'li' })],
    });
    const out = blockToReact(forNode, opts(), component(), true);
    expect(out.startsWith('{')).toBe(true);
    expect(out.endsWith('}')).toBe(true);
  });

  it('emits a Fragment by concatenating children', () => {
    const frag = node({
      name: 'Fragment',
      children: [node({ name: 'a' })],
    });
    const out = collapseWs(blockToReact(frag, opts(), component(), false));
    expect(out).toContain('<a />');
  });
});

describe('blockToReact — preact stripping (regression guard)', () => {
  it('does not branch on options.preact for ref bindings (always rewrites props.x to x)', () => {
    const n = node({
      name: 'input',
      bindings: { ref: expr('props.formRef') },
    });
    // `preact` is not a ToReactOptions field anymore, but cast to verify
    // the stripped code path still rewrites props refs.
    const out = collapseWs(
      blockToReact(n, opts({ type: 'dom' } as Partial<ToReactOptions>), component(), false),
    );
    expect(out).toContain('ref={formRef}');
  });
});
