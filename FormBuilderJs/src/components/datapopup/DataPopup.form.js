import Components from '../Components';
import ContainerForm from '../container/Container.form';

export default function(...extend) {
  return ContainerForm([
    {
      key: 'display',
      components: [
        {
          key: 'label',
          ignore: false
        },
        {
          key: 'description',
          ignore: false
        },
        {
          key: 'hidden',
          ignore: false
        },
        {
          key: 'disabled',
          ignore: false
        }
      ]
    }
  ], ...extend);
}
