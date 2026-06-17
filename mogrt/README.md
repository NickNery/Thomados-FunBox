# MOGRT templates

Place the text template files used by `TextAnimationGallery` in this folder:

- `text-pop-in.mogrt`
- `text-slide-up.mogrt`
- `text-fade-scale.mogrt`
- `text-typewriter.mogrt`

The JSX host imports these files with `Sequence.importMGT()` at the current playhead, then applies timeline keyframes to the inserted graphics clip when Premiere exposes Scale, Position, and Opacity parameters.
