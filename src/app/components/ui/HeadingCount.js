import CountBadge from './CountBadge';
export default function HeadingCount({title,count,as:Tag='h3',className='',titleClassName=''}) {
 return <div className={`heading-count ${className}`}>{title&&<Tag className={titleClassName}>{title}</Tag>}{count!=null&&<CountBadge>{count}</CountBadge>}</div>;
}
